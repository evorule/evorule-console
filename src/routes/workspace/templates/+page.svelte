<!--
  SPDX-License-Identifier: AGPL-3.0-or-later
  Copyright (C) 2026 EvoRule Project
  evorule-console 插件模板页（通用表单薄切片,Plugin Contract v1 §5）
-->
<!--
  职责:
    - 列出已装载声明式 pack 的规则模板（GET /api/plugins + assets/templates）
    - 按 params_form 渲染通用表单（8 控件词表;scene_field 下拉来自场景已注册 path 字段）
    - generate → 草稿预览（JsonTree）+ 复制
  红线对齐:
    - R3 draft-only:本页只生成草稿并展示,不写入规则库——生效仍走既有 Draft→Publish 链
    - R5 locale 纯展示:display_name 双语字段仅用于界面展示
  数据流:PluginPacksClient（默认 127.0.0.1:18080,loopback 免认证;
    server 启用 --auth-token 时经 localStorage 'evorule.authToken' 传 Bearer）
-->

<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import JsonTree from "$lib/views/StateView/JsonTree.svelte";
  import {
    PluginPacksClient,
    PluginPacksError,
    dn,
    type PluginSummary,
    type TemplateAssetRaw,
    type SceneAssetRaw,
    type SceneFieldRaw,
    type ParamFieldRaw,
  } from "$lib/backend/plugin-packs";

  let client: PluginPacksClient | null = null;
  let loading = $state(true);
  let loadError = $state<string | null>(null);

  let packs = $state<PluginSummary[]>([]);
  let currentPackId = $state<string | null>(null);
  let templates = $state<TemplateAssetRaw[]>([]);
  let scenes = $state<SceneAssetRaw[]>([]);
  let selectedTemplateId = $state<string | null>(null);

  // 表单值（字符串态;generate 时按控件类型定型）
  let formValues = $state<Record<string, string | boolean>>({});
  let generating = $state(false);
  let generateError = $state<string | null>(null);
  let draft = $state<unknown>(null);
  let draftProvenance = $state<Record<string, unknown> | null>(null);
  let copied = $state(false);

  const selectedTemplate = $derived(
    templates.find((t) => t.template_id === selectedTemplateId) ?? null,
  );

  onMount(() => {
    const token =
      typeof localStorage !== "undefined"
        ? localStorage.getItem("evorule.authToken")
        : null;
    client = new PluginPacksClient(undefined, token);
    void load();
  });

  async function load() {
    if (!client) return;
    loading = true;
    loadError = null;
    try {
      packs = await client.listPacks();
      if (packs.length > 0) {
        await selectPack(packs[0].id);
      }
    } catch (e) {
      loadError = e instanceof PluginPacksError ? e.message : String(e);
    } finally {
      loading = false;
    }
  }

  async function selectPack(packId: string) {
    if (!client) return;
    currentPackId = packId;
    selectedTemplateId = null;
    draft = null;
    draftProvenance = null;
    generateError = null;
    try {
      const [t, s] = await Promise.all([
        client.getTemplates(packId),
        client.getScenes(packId),
      ]);
      templates = t;
      scenes = s;
      if (t.length > 0) selectTemplate(t[0].template_id);
    } catch (e) {
      loadError = e instanceof PluginPacksError ? e.message : String(e);
    }
  }

  function selectTemplate(templateId: string) {
    selectedTemplateId = templateId;
    draft = null;
    draftProvenance = null;
    generateError = null;
    copied = false;
    // 用 default 预填表单
    const values: Record<string, string | boolean> = {};
    const tpl = templates.find((t) => t.template_id === templateId);
    if (tpl) {
      for (const p of tpl.params_form) {
        if (p.default !== undefined) {
          values[p.field_id] =
            p.type === "boolean" ? Boolean(p.default) : String(p.default);
        } else if (p.type === "boolean") {
          values[p.field_id] = false;
        }
      }
    }
    formValues = values;
  }

  /** scene_field 下拉来源:模板 scene_ref（参数级优先）对应场景中声明了 path 的字段。
   *  未声明 path 的字段不在 .path 索引内（R2 锁定）,不可作 .path 取值。 */
  function pathedFields(param: ParamFieldRaw): SceneFieldRaw[] {
    const sceneRef = param.scene_ref ?? selectedTemplate?.scene_ref;
    const pool = sceneRef
      ? scenes.filter((s) => s.scene_id === sceneRef)
      : scenes;
    return pool
      .flatMap((s) => s.business_objects.flatMap((bo) => bo.fields))
      .filter((f) => typeof f.path === "string" && f.path.length > 0);
  }

  /** 按控件词表把字符串态表单值定型为 JSON 值（server 端仍会 fail-fast 复检） */
  function buildForm(): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    if (!selectedTemplate) return out;
    for (const p of selectedTemplate.params_form) {
      const raw = formValues[p.field_id];
      if (p.type === "boolean") {
        out[p.field_id] = Boolean(raw);
      } else if (raw === undefined || raw === "") {
        continue; // 空值交由 server 必填校验兜底（显式报错,不静默）
      } else if (p.type === "number" || p.type === "currency") {
        out[p.field_id] = Number(raw);
      } else {
        out[p.field_id] = raw;
      }
    }
    return out;
  }

  async function handleGenerate() {
    if (!client || !currentPackId || !selectedTemplate) return;
    generating = true;
    generateError = null;
    copied = false;
    try {
      const result = await client.generate(
        currentPackId,
        selectedTemplate.template_id,
        buildForm(),
      );
      draft = result.rule_draft;
      draftProvenance = result.provenance as Record<string, unknown>;
    } catch (e) {
      draft = null;
      draftProvenance = null;
      generateError = e instanceof PluginPacksError ? e.message : String(e);
    } finally {
      generating = false;
    }
  }

  async function handleCopy() {
    if (draft === null) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(draft, null, 2));
      copied = true;
      setTimeout(() => (copied = false), 1500);
    } catch {
      // 剪贴板不可用（非安全上下文等）:静默,预览区 JSON 本身可手动复制
    }
  }

  function handlePackChange(e: Event) {
    const id = (e.target as HTMLSelectElement).value;
    if (id) void selectPack(id);
  }
</script>

<div class="templates-page">
  <!-- === 顶部导航 === -->
  <header class="tpl-topbar">
    <div class="brand">
      <span class="brand-mark">evorule</span>
      <span class="brand-sep">/</span>
      <span class="brand-section">插件模板</span>
    </div>
    <span class="tpl-hint">从插件包模板生成规则草稿 · 草稿不落库,生效走既有发布链</span>
    <div class="topbar-actions">
      <button class="btn-secondary" onclick={() => goto("/workspace")}>
        返回工作空间
      </button>
    </div>
  </header>

  {#if loadError}
    <div class="error-banner" role="alert">
      <span>⚠</span>
      <span>{loadError}</span>
    </div>
  {/if}

  {#if loading}
    <div class="empty-state">
      <p>加载插件清单中…</p>
    </div>
  {:else if packs.length === 0}
    <div class="empty-state">
      <span class="empty-icon">🧩</span>
      <p>未装载任何声明式插件包</p>
      <p class="empty-hint">
        server 启动需携带 --plugins 清单,并以
        {"{"}"enabled":true,"pack":"路径/pack.json"{"}"} 形态登记 pack 条目
      </p>
    </div>
  {:else}
    <div class="pack-bar">
      <label for="pack-select" class="pack-label">插件包</label>
      <select id="pack-select" class="pack-select" value={currentPackId ?? ""} onchange={handlePackChange}>
        {#each packs as p (p.id)}
          <option value={p.id}>{p.id} v{p.version}（{p.assets.templates} 模板）</option>
        {/each}
      </select>
    </div>

    <div class="tpl-layout">
      <!-- === 模板列表 === -->
      <aside class="tpl-list" aria-label="模板列表">
        {#each templates as t (t.template_id)}
          <button
            class="tpl-row"
            class:active={t.template_id === selectedTemplateId}
            onclick={() => selectTemplate(t.template_id)}
          >
            <span class="tpl-name">{dn(t.display_name, t.template_id)}</span>
            <span class="tpl-id">{t.template_id}</span>
          </button>
        {/each}
      </aside>

      <!-- === 表单 + 预览 === -->
      <section class="tpl-main">
        {#if selectedTemplate}
          <h2 class="tpl-title">
            {dn(selectedTemplate.display_name, selectedTemplate.template_id)}
          </h2>
          {#if selectedTemplate.description}
            <p class="tpl-desc">{selectedTemplate.description}</p>
          {/if}

          <form class="tpl-form" onsubmit={(e) => { e.preventDefault(); void handleGenerate(); }}>
            {#each selectedTemplate.params_form as p (p.field_id)}
              <div class="form-field">
                <label class="field-label" for="f-{p.field_id}">
                  {dn(p.display_name, p.field_id)}
                  <span class="field-type">{p.type}</span>
                  {#if p.required}<span class="field-req" title="必填">*</span>{/if}
                </label>

                {#if p.type === "scene_field"}
                  {@const fields = pathedFields(p)}
                  <select
                    id="f-{p.field_id}"
                    class="field-input"
                    value={String(formValues[p.field_id] ?? "")}
                    onchange={(e) => (formValues[p.field_id] = (e.target as HTMLSelectElement).value)}
                  >
                    <option value="">（选择场景字段）</option>
                    {#each fields as f (f.field_id)}
                      <option value={f.field_id}>{dn(f.display_name, f.field_id)}（{f.field_id}）</option>
                    {/each}
                  </select>
                  {#if fields.length === 0}
                    <span class="field-warn">场景中无已注册 path 的字段</span>
                  {/if}
                {:else if p.type === "enum"}
                  <select
                    id="f-{p.field_id}"
                    class="field-input"
                    value={String(formValues[p.field_id] ?? "")}
                    onchange={(e) => (formValues[p.field_id] = (e.target as HTMLSelectElement).value)}
                  >
                    <option value="">（选择）</option>
                    {#each p.options ?? [] as opt (opt)}
                      <option value={opt}>{opt}</option>
                    {/each}
                  </select>
                {:else if p.type === "boolean"}
                  <input
                    id="f-{p.field_id}"
                    type="checkbox"
                    checked={Boolean(formValues[p.field_id])}
                    onchange={(e) => (formValues[p.field_id] = (e.target as HTMLInputElement).checked)}
                  />
                {:else if p.type === "textarea"}
                  <textarea
                    id="f-{p.field_id}"
                    class="field-input"
                    rows="3"
                    value={String(formValues[p.field_id] ?? "")}
                    oninput={(e) => (formValues[p.field_id] = (e.target as HTMLTextAreaElement).value)}
                  ></textarea>
                {:else}
                  <input
                    id="f-{p.field_id}"
                    type={p.type === "number" || p.type === "currency" ? "number" : p.type === "date" ? "date" : "text"}
                    class="field-input"
                    value={String(formValues[p.field_id] ?? "")}
                    oninput={(e) => (formValues[p.field_id] = (e.target as HTMLInputElement).value)}
                  />
                {/if}
              </div>
            {/each}

            <div class="form-actions">
              <button type="submit" class="btn-primary" disabled={generating}>
                {generating ? "生成中…" : "生成草稿"}
              </button>
              {#if draft !== null}
                <button type="button" class="btn-secondary" onclick={handleCopy}>
                  {copied ? "已复制" : "复制 JSON"}
                </button>
              {/if}
            </div>
          </form>

          {#if generateError}
            <div class="error-banner" role="alert">
              <span>⚠</span>
              <span>{generateError}</span>
            </div>
          {/if}

          {#if draft !== null}
            <div class="draft-section">
              <header class="section-header">
                <h3>规则草稿预览</h3>
                {#if draftProvenance}
                  <span class="provenance">
                    pack {draftProvenance.pack} v{draftProvenance.pack_version}
                    · template {draftProvenance.template}
                    · contract {draftProvenance.contract_version}
                  </span>
                {/if}
              </header>
              <div class="draft-tree">
                <JsonTree data={draft} rootLabel="rule_draft" />
              </div>
            </div>
          {/if}
        {:else}
          <div class="empty-state">
            <p>从左侧选择一个模板</p>
          </div>
        {/if}
      </section>
    </div>
  {/if}
</div>

<style>
  .templates-page {
    padding: var(--spacing-lg);
    max-width: 1200px;
    margin: 0 auto;
  }

  .tpl-topbar {
    display: flex;
    align-items: center;
    gap: var(--spacing-lg);
    padding-bottom: var(--spacing-md);
    border-bottom: 1px solid var(--border);
    margin-bottom: var(--spacing-lg);
    flex-wrap: wrap;
  }

  .brand {
    display: flex;
    align-items: baseline;
    gap: var(--spacing-xs);
    font-family: var(--font-mono);
  }

  .brand-mark {
    font-size: var(--text-lg);
    font-weight: var(--font-semibold);
    color: var(--text-primary);
  }

  .brand-sep {
    color: var(--text-secondary);
  }

  .brand-section {
    font-size: var(--text-sm);
    color: var(--text-secondary);
  }

  .tpl-hint {
    margin-right: auto;
    font-size: var(--text-xs);
    color: var(--text-secondary);
  }

  .topbar-actions {
    display: flex;
    gap: var(--spacing-sm);
  }

  .btn-primary,
  .btn-secondary {
    padding: var(--spacing-xs) var(--spacing-md);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    cursor: pointer;
  }

  .btn-primary {
    background: var(--brand);
    color: #fff;
    border: 1px solid var(--brand);
  }

  .btn-secondary {
    background: var(--bg-card);
    color: var(--text-primary);
    border: 1px solid var(--border);
  }

  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .error-banner {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    background: color-mix(in srgb, var(--danger) 8%, var(--bg-card));
    border: 1px solid var(--danger);
    border-radius: var(--radius-md);
    color: var(--danger);
    font-size: var(--text-sm);
    margin-bottom: var(--spacing-md);
  }

  .pack-bar {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    margin-bottom: var(--spacing-md);
  }

  .pack-label {
    font-size: var(--text-xs);
    color: var(--text-secondary);
    font-weight: var(--font-medium);
  }

  .pack-select {
    min-width: 280px;
    font-size: var(--text-sm);
  }

  .tpl-layout {
    display: grid;
    grid-template-columns: 280px 1fr;
    gap: var(--spacing-lg);
    align-items: start;
  }

  .tpl-list {
    display: flex;
    flex-direction: column;
    background: var(--bg-card);
    border: var(--card-border);
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .tpl-row {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    padding: var(--spacing-sm) var(--spacing-md);
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--border);
    cursor: pointer;
    text-align: left;
    font-family: var(--font-sans);
    transition: background var(--transition-fast);
  }

  .tpl-row:last-child {
    border-bottom: none;
  }

  .tpl-row:hover {
    background: var(--bg-hover);
  }

  .tpl-row.active {
    background: var(--bg-hover);
    box-shadow: inset 2px 0 0 var(--brand);
  }

  .tpl-name {
    font-size: var(--text-sm);
    color: var(--text-primary);
    font-weight: var(--font-medium);
  }

  .tpl-id {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--text-secondary);
  }

  .tpl-main {
    background: var(--bg-card);
    border: var(--card-border);
    border-radius: var(--radius-md);
    padding: var(--spacing-lg);
    min-width: 0;
  }

  .tpl-title {
    margin: 0 0 var(--spacing-xs) 0;
    font-size: var(--text-lg);
    color: var(--text-primary);
    font-weight: var(--font-semibold);
  }

  .tpl-desc {
    margin: 0 0 var(--spacing-md) 0;
    font-size: var(--text-xs);
    color: var(--text-secondary);
  }

  .tpl-form {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
    max-width: 480px;
  }

  .form-field {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .field-label {
    display: flex;
    align-items: baseline;
    gap: var(--spacing-sm);
    font-size: var(--text-sm);
    color: var(--text-primary);
    font-weight: var(--font-medium);
  }

  .field-type {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--text-secondary);
    font-weight: var(--font-regular, 400);
  }

  .field-req {
    color: var(--danger);
  }

  .field-input {
    font-size: var(--text-sm);
    padding: var(--spacing-xs) var(--spacing-sm);
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    color: var(--text-primary);
  }

  .field-input:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }

  .field-warn {
    font-size: var(--text-xs);
    color: var(--warning);
  }

  .form-actions {
    display: flex;
    gap: var(--spacing-sm);
    margin-top: var(--spacing-sm);
  }

  .draft-section {
    margin-top: var(--spacing-lg);
    border-top: 1px solid var(--border);
    padding-top: var(--spacing-md);
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: var(--spacing-md);
    margin-bottom: var(--spacing-sm);
    flex-wrap: wrap;
  }

  .section-header h3 {
    margin: 0;
    font-size: var(--text-base);
    color: var(--text-primary);
    font-weight: var(--font-semibold);
  }

  .provenance {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--text-secondary);
  }

  .draft-tree {
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: var(--spacing-md);
    overflow: auto;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-2xl);
    color: var(--text-secondary);
    text-align: center;
    background: var(--bg-card);
    border: 1px dashed var(--border);
    border-radius: var(--radius-md);
  }

  .empty-icon {
    font-size: 48px;
    margin-bottom: var(--spacing-md);
  }

  .empty-hint {
    font-size: var(--text-xs);
    margin-top: var(--spacing-xs);
    color: var(--text-secondary);
  }

  @media (max-width: 900px) {
    .tpl-layout {
      grid-template-columns: 1fr;
    }
  }
</style>
