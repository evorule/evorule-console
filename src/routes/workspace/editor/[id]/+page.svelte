<!--
  SPDX-License-Identifier: AGPL-3.0-or-later
  Copyright (C) 2026 EvoRule Project
  evorule-console 规则编辑器路由 (阶段 D.1.2 双模式编辑器)
-->
<!--
  依据: 设计文档/01_界面升级.txt §三.2 (编辑页线框) + 02_编辑页面.txt
        实施文档_界面升级_v1.0.md §D.1.2
  职责:
    - 双模式编辑: form (condition/action/metadata 表单) ↔ json (transform 原始 JSON)
    - form 模式: 字段变化调 translateToTransform 派生 content (100ms 防抖)
    - json 模式: textarea 直接编辑完整规则 JSON
    - form→json 切换: translateToConditional 回译, lossy=true 显示横幅
    - 底部黑匣子: JSON 预览 + G1-G7 7灯 (复用 RuleValidator.validate)
    - LLM 按钮槽位 (仅 $assistant 非 null 时渲染)
    - 只读规则: 全字段 disabled + 保存禁用
  数据流:
    - content 是规范字符串 (完整规则 JSON: {id,version,description,transform:[...]})
    - validation 始终跑在 content 上 (单一真相源)
    - onMount: !isNew && rule.content===undefined → loadRuleContent
-->

<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import {
    rules,
    loadRuleContent,
    ensureRule,
    addRule,
    updateRule,
    isRuleReadonly,
  } from "$lib/stores/rules";
  import { currentWorkspaceId } from "$lib/stores/workspace";
  import { useWorkspaceBackendOrNull } from "$lib/backend/workspace-context";
  import { useAssistantOrNull } from "$lib/assistant/assistant-context";
  import {
    RuleValidator,
    type ValidationResult,
  } from "$lib/validators/ruleValidator";
  import type { Rule } from "$lib/stores/rules";
  import {
    BUILTIN_FIELDS,
    BUSINESS_OPS,
    BUSINESS_ACTIONS,
    findField,
    businessRuleToTranslateInput,
    translateOutputToBusinessRule,
    summarize,
    type BusinessOp,
    type BusinessAction,
  } from "$lib/views/business-rule-model";

  const backend = useWorkspaceBackendOrNull();
  const assistant = useAssistantOrNull();

  let id = $derived(page.params.id);
  let isNew = $derived(id === "new");

  // 当前规则 (从 rules store 派生; new 时为 null)
  let rule = $derived<Rule | null>(
    isNew ? null : $rules.find((r) => r.id === id) ?? null,
  );
  let readonly = $derived(rule ? isRuleReadonly(rule) : false);

  // === 编辑模式 ===
  let mode = $state<"form" | "json">("form");

  // === 规范内容 (单一真相源) ===
  let content = $state<string>("");
  let loading = $state(true);
  let saving = $state(false);
  let saveMsg = $state<string | null>(null);

  // === form 模式字段 (复用 BusinessRule 模型) ===
  interface CondRow {
    field: string;
    op: BusinessOp;
    value: string;
  }
  interface ActionRow {
    type: BusinessAction;
    role: string;
  }
  let conditions = $state<CondRow[]>([]);
  let actions = $state<ActionRow[]>([]);
  /** 回译后是否超子集 (只读, 引导切 JSON) */
  let formUnsupported = $state(false);
  let formUnsupportedReason = $state<string | null>(null);
  let metaName = $state("");
  let metaDesc = $state("");

  // === lossy 回译标注 ===
  let lossyInfo = $state<{ lossy: boolean; lostItems: string[] } | null>(null);

  // === 校验 (7 灯数据源, 始终跑在 content 上) ===
  let validation = $state<ValidationResult>({ valid: false, errors: [] });

  const GATES = ["G1", "G2", "G3", "G4", "G5", "G6", "G7"] as const;
  const GATE_DESC: Record<string, string> = {
    G1: "JSON 格式",
    G2: "元指令类型",
    G3: "IO 双路径",
    G4: "域类型",
    G5: "路径引用",
    G6: "兜底 all([])",
    G7: "递归深度≤64",
  };

  let gateStatus = $derived(
    GATES.map((g) => {
      const err = validation.errors.find((e) => e.gate === g);
      return { gate: g, passed: !err, message: err?.message ?? null };
    }),
  );

  let canSave = $derived(validation.valid && !saving && !readonly);

  // === onMount: 加载规则内容 ===
  // currentWorkspaceId 由 +layout.svelte onMount(refreshWorkspaces)异步水合,
  // 而 Svelte 中子组件 onMount 先于父组件 onMount 执行 → 直接导航到
  // /workspace/editor/{id} 时本 onMount 运行 wsId 仍可能为 null。
  // 故已有规则分支订阅等待 wsId 可用后再加载,避免提前返回误显示"未找到规则"。
  onMount(() => {
    if (!backend) {
      loading = false;
      return;
    }

    if (isNew) {
      // 新建: 模板不依赖 wsId,立即展示(保存时 handleSave 读 $currentWorkspaceId)
      content = JSON.stringify(
        {
          id: `user.${Date.now()}`,
          version: 1,
          description: "",
          transform: [
            { type: "branch", params: { domain: { type: "all", domains: [] }, on_true: [] } },
          ],
        },
        null,
        2,
      );
      metaName = `user.new.${Date.now()}`;
      metaDesc = "";
      conditions = [];
      actions = [];
      loading = false;
      return;
    }

    // 已有规则: 需 wsId 才能按 id 拉取
    if (!id) {
      loading = false;
      return;
    }
    const b = backend;
    const ruleId = id;
    let done = false;
    // 注意:不要在 cb 内调 unsub() —— store.subscribe 首次会同步用当前值调用 cb,
    // 此时 `const unsub = ...` 赋值尚未完成,unsub 处于 TDZ,引用会抛
    // ReferenceError: Cannot access 'unsub' before initialization(从列表点入时
    // wsId 已水合为非 null,会立即触发该错误,使 loading 永不归 false → 一直"加载中")。
    // 改由 done 标志防重复触发,unsub 在 onMount 清理函数里调。
    const unsub = currentWorkspaceId.subscribe((wsId) => {
      if (done || !wsId) return;
      done = true;
      void (async () => {
        // 直接导航时 $rules 可能未含此规则(refreshRules 仅在 /workspace 路由调用)
        // → 先 ensureRule 按 id 拉取元数据,否则 loadRuleContent 会因 store 无此
        // 规则提前返回 null,且派生的 rule 为 null → 误显示"未找到规则"。
        await ensureRule(b, wsId, ruleId);
        const c = await loadRuleContent(b, wsId, ruleId);
        if (c !== null) {
          content = c;
          // 默认进 form 模式时尝试回译 (lossy 检测)
          await tryPopulateFormFromContent();
        }
        loading = false;
      })();
    });
    return () => {
      done = true;
      unsub();
    };
  });

  // === 校验 effect: content 变化时重跑 ===
  $effect(() => {
    validation = RuleValidator.validate(content);
  });

  // === form → content 派生 (防抖 100ms) ===
  let deriveTimer: ReturnType<typeof setTimeout> | null = null;
  let isPopulating = false; // 回译填充时抑制派生,避免循环

  $effect(() => {
    // 依赖 form 字段变化
    void conditions;
    void actions;
    void metaName;
    void metaDesc;
    // formUnsupported 时回译得到的 conditions/actions 不完整,
    // 派生会覆盖原始 content 丢失信息 → 跳过, 强制用户切 JSON 编辑
    if (mode !== "form" || isPopulating || !backend || formUnsupported) return;
    if (deriveTimer) clearTimeout(deriveTimer);
    deriveTimer = setTimeout(() => {
      deriveContentFromForm();
    }, 100);
  });

  /** form 字段 → translateToTransform → 重建 content */
  async function deriveContentFromForm() {
    if (!backend) return;
    try {
      // 用共享模型转换 (决策3): field 用业务 id → businessRuleToTranslateInput 内部
      // 反查 path; gte/gt 由 server 翻译成 not(lt)/not(all) (决策1)
      const { condition, action_set } = businessRuleToTranslateInput({
        conditions: conditions.map((c) => ({
          field: c.field,
          op: c.op,
          value: tryParseValue(c.value),
        })),
        actions: actions.map((a) => ({ type: a.type, role: a.role })),
      });
      const resp = await backend.translateToTransform({
        condition,
        action_set,
        metadata: { name: metaName, description: metaDesc },
      });
      const transform = resp.transform;
      const baseId = isNew ? metaName || `user.${Date.now()}` : rule?.name ?? metaName;
      const obj = {
        id: baseId,
        version: rule?.version ?? 1,
        description: metaDesc,
        transform,
      };
      content = JSON.stringify(obj, null, 2);
    } catch (e) {
      // 转译失败 (如 server 未启动): 不覆盖 content, 仅记录
      saveMsg = `转译失败 (form→transform): ${(e as Error).message}`;
    }
  }

  /** content → translateToConditional → 填充 form 字段 (lossy/unsupported 检测) */
  async function tryPopulateFormFromContent() {
    if (!backend) return;
    let parsed: { transform?: unknown[]; id?: string; description?: string };
    try {
      parsed = JSON.parse(content);
    } catch {
      return; // JSON 无效, 不回译
    }
    const transform = Array.isArray(parsed.transform) ? parsed.transform : [];
    if (transform.length === 0) return;

    try {
      const resp = await backend.translateToConditional({ transform });
      // 先置 isPopulating 抑制派生 effect, 再批量赋值, 避免中间态触发 deriveContentFromForm
      isPopulating = true;
      const br = translateOutputToBusinessRule(
        resp.condition,
        resp.action_set,
        resp.lossy,
        resp.lost_items,
      );
      conditions = br.conditions.map((c) => ({
        field: c.field,
        op: c.op,
        value: formatValue(c.value),
      }));
      actions = br.actions.map((a) => ({ type: a.type, role: a.role }));
      metaName = parsed.id ?? "";
      metaDesc = parsed.description ?? "";
      formUnsupported = br.unsupported ?? false;
      formUnsupportedReason = br.unsupportedReason ?? null;
      lossyInfo = resp.lossy
        ? { lossy: true, lostItems: resp.lost_items }
        : { lossy: false, lostItems: [] };
      isPopulating = false;
    } catch {
      // 回译失败: 保持 form 字段为空, 不阻断编辑 (用户可切 JSON 模式)
      isPopulating = false;
      lossyInfo = null;
      formUnsupported = false;
      formUnsupportedReason = null;
    }
  }

  /** 切换模式 */
  async function switchMode(next: "form" | "json") {
    if (next === mode) return;
    if (next === "form") {
      // json → form: 回译填充
      await tryPopulateFormFromContent();
    }
    // form → json: 派生已在 effect 中完成, 直接切换
    mode = next;
  }

  // === 表单行操作 ===
  function addCondition() {
    if (readonly || formUnsupported) return;
    // 默认用第一个内置字段 + gte (最常见业务比较符, server 翻译成 not(lt))
    conditions = [
      ...conditions,
      { field: BUILTIN_FIELDS[0].id, op: "gte", value: "" },
    ];
  }
  function removeCondition(i: number) {
    if (readonly || formUnsupported) return;
    conditions = conditions.filter((_, idx) => idx !== i);
  }
  function addAction() {
    if (readonly || formUnsupported) return;
    actions = [...actions, { type: "notify", role: "" }];
  }
  function removeAction(i: number) {
    if (readonly || formUnsupported) return;
    actions = actions.filter((_, idx) => idx !== i);
  }

  // === 保存 ===
  async function handleSave() {
    if (!backend || !canSave) return;
    const wsId = $currentWorkspaceId;
    if (!wsId) return;

    // 保存前格式化
    try {
      const parsed = JSON.parse(content);
      content = JSON.stringify(parsed, null, 2);
    } catch {
      // 无效 JSON, canSave 已拦截
      return;
    }

    saving = true;
    saveMsg = null;
    try {
      if (isNew) {
        const newId = await addRule(backend, wsId, {
          name: metaName || `user.${Date.now()}`,
          content,
          description: metaDesc || undefined,
        });
        saveMsg = "✅ 已创建";
        goto(`/workspace/editor/${newId}`);
      } else {
        // 仅 Draft 状态允许更新内容
        if (!id) return;
        if (rule && rule.state !== "draft") {
          saveMsg = `⚠ 规则状态为 ${rule.state},仅 draft 允许编辑内容`;
          return;
        }
        await updateRule(backend, wsId, id, { content });
        saveMsg = "✅ 已保存";
      }
    } catch (e) {
      saveMsg = `❌ 保存失败: ${(e as Error).message}`;
    } finally {
      saving = false;
    }
  }

  function handleBack() {
    goto("/workspace");
  }

  function handleFormat() {
    try {
      const parsed = JSON.parse(content);
      content = JSON.stringify(parsed, null, 2);
    } catch {
      // 无效 JSON, 忽略
    }
  }

  // === 值格式化辅助 ===
  function tryParseValue(s: string): unknown {
    if (s === "") return "";
    try {
      return JSON.parse(s);
    } catch {
      return s; // 非数字/布尔时作字符串
    }
  }
  function formatValue(v: unknown): string {
    if (v === null || v === undefined) return "";
    if (typeof v === "string") return v;
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }

  // === 翻译预览 (自然语言摘要, 对齐 onboarding step 3) ===
  let translationPreview = $derived(
    conditions.length === 0 && actions.length === 0
      ? "📖 还未填写条件与动作"
      : "📖 " +
          summarize({
            conditions: conditions.map((c) => ({
              field: c.field,
              op: c.op,
              value: tryParseValue(c.value),
            })),
            actions: actions.map((a) => ({ type: a.type, role: a.role })),
          }),
  );

  // OP_OPTIONS/ACTION_OPS 已移除 — 改用共享模型 BUILTIN_FIELDS/BUSINESS_OPS/BUSINESS_ACTIONS
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.key === "Escape") handleBack();
  }}
/>

<div class="editor-page">
  <!-- === 顶部栏 === -->
  <header class="editor-topbar">
    <button class="btn-text" onclick={handleBack} aria-label="返回">← 返回</button>

    <div class="title-group">
      <h1>{isNew ? "新建规则" : rule?.name ?? id}</h1>
      {#if rule}
        <span class="state-badge state-{rule.state}">{rule.state}</span>
      {/if}
      {#if readonly}
        <span class="readonly-tag">只读</span>
      {/if}
    </div>

    <div class="mode-switch" role="tablist" aria-label="编辑模式">
      <button
        class="mode-btn"
        class:active={mode === "form"}
        role="tab"
        aria-selected={mode === "form"}
        onclick={() => switchMode("form")}
      >
        表单
      </button>
      <button
        class="mode-btn"
        class:active={mode === "json"}
        role="tab"
        aria-selected={mode === "json"}
        onclick={() => switchMode("json")}
      >
        JSON
      </button>
    </div>

    <div class="topbar-actions">
      {#if assistant}
        <button class="btn-secondary" disabled={readonly}>✦ LLM 辅助</button>
      {/if}
      <button class="btn-secondary" onclick={handleFormat}>格式化</button>
      <button class="btn-primary" onclick={handleSave} disabled={!canSave}>
        {saving ? "保存中…" : "保存"}
      </button>
    </div>
  </header>

  {#if !backend}
    <div class="empty-state">
      <p>backend 未注入(开发期需要 evorule-server)</p>
    </div>
  {:else if loading}
    <div class="empty-state"><p>加载中…</p></div>
  {:else if !isNew && !rule}
    <div class="empty-state">
      <p>未找到规则 {id}</p>
      <button class="btn-secondary" onclick={handleBack}>返回工作空间</button>
    </div>
  {:else}
    <div class="editor-body">
      <!-- === 左 30% 缩略列表 === -->
      <aside class="rule-thumbs">
        <header class="thumbs-header">
          <h2>规则列表</h2>
        </header>
        <div class="thumbs-list">
          {#each $rules as r (r.id)}
            <button
              class="thumb-item"
              class:active={r.id === id}
              onclick={() => goto(`/workspace/editor/${r.id}`)}
            >
              <span
                class="state-dot"
                style="background: var(--{r.state === 'active' ? 'success' : r.state === 'draft' ? 'warning' : r.state === 'blocked' ? 'danger' : 'text-secondary'})"
              ></span>
              <span class="thumb-name">{r.name}</span>
            </button>
          {/each}
        </div>
      </aside>

      <!-- === 右 70% 编辑区 === -->
      <main class="edit-area">
        {#if saveMsg}
          <div class="save-msg" class:ok={saveMsg.startsWith("✅")} class:warn={saveMsg.startsWith("⚠")} class:err={saveMsg.startsWith("❌")}>
            {saveMsg}
          </div>
        {/if}

        {#if formUnsupported}
          <div class="unsupported-banner">
            <strong>⚠ 超出业务表单范围</strong>
            <span>该规则含表单不支持的结构,form 模式已切为只读。请切到 <strong>JSON</strong> 模式查看或编辑完整内容。</span>
            {#if formUnsupportedReason}
              <div class="unsupported-reason">原因: {formUnsupportedReason}</div>
            {/if}
          </div>
        {/if}

        {#if mode === "form"}
          <!-- === form 模式 === -->
          <section class="form-section">
            <h3 class="form-title">元数据</h3>
            <div class="form-row">
              <label class="field">
                <span class="field-label">规则名 (name)</span>
                <input bind:value={metaName} disabled={readonly || formUnsupported} placeholder="user.my_rule" />
              </label>
              <label class="field field-grow">
                <span class="field-label">描述 (description)</span>
                <input bind:value={metaDesc} disabled={readonly || formUnsupported} placeholder="业务专家可读的描述" />
              </label>
            </div>
          </section>

          <section class="form-section">
            <div class="section-head">
              <h3 class="form-title">条件 (满足全部即触发)</h3>
              <button class="btn-mini" onclick={addCondition} disabled={readonly || formUnsupported}>+ 添加</button>
            </div>
            {#if conditions.length === 0}
              <p class="empty-mini">无条件(规则将对所有输入生效)</p>
            {:else}
              {#each conditions as cond, i (i)}
                <div class="form-row form-row-cond">
                  <select
                    class="cond-field"
                    bind:value={cond.field}
                    disabled={readonly || formUnsupported}
                    aria-label="字段"
                  >
                    {#each BUILTIN_FIELDS as f}
                      <option value={f.id}>{f.label}</option>
                    {/each}
                  </select>
                  <select
                    class="cond-op"
                    bind:value={cond.op}
                    disabled={readonly || formUnsupported}
                    aria-label="比较符"
                  >
                    {#each BUSINESS_OPS as o}
                      <option value={o.id}>{o.symbol} {o.label}</option>
                    {/each}
                  </select>
                  <input
                    class="cond-value"
                    type={findField(cond.field)?.inputType ?? "text"}
                    bind:value={cond.value}
                    disabled={readonly || formUnsupported}
                    placeholder="值"
                    aria-label="值"
                  />
                  <button class="btn-mini btn-remove" onclick={() => removeCondition(i)} disabled={readonly || formUnsupported}>✕</button>
                </div>
              {/each}
            {/if}
          </section>

          <section class="form-section">
            <div class="section-head">
              <h3 class="form-title">动作 (打标记)</h3>
              <button class="btn-mini" onclick={addAction} disabled={readonly || formUnsupported}>+ 添加</button>
            </div>
            {#if actions.length === 0}
              <p class="empty-mini">无动作(规则仅判定,不写标记)</p>
            {:else}
              {#each actions as act, i (i)}
                <div class="form-row form-row-cond">
                  <select
                    class="cond-field"
                    bind:value={act.type}
                    disabled={readonly || formUnsupported}
                    aria-label="动作"
                  >
                    {#each BUSINESS_ACTIONS as a}
                      <option value={a.id}>{a.label} ({a.desc})</option>
                    {/each}
                  </select>
                  <input
                    class="cond-value cond-value-wide"
                    bind:value={act.role}
                    disabled={readonly || formUnsupported}
                    placeholder="角色/渠道 (如 CFO)"
                    aria-label="角色"
                  />
                  <button class="btn-mini btn-remove" onclick={() => removeAction(i)} disabled={readonly || formUnsupported}>✕</button>
                </div>
              {/each}
            {/if}
          </section>

          <div class="translation-preview" aria-live="polite">
            {translationPreview}
          </div>

          <p class="form-hint">
            表单字段变化时自动调 <code>translateToTransform</code> 派生规则内容(100ms 防抖)。
            <code>gte</code>/<code>gt</code> 由 server 翻译成 <code>not(lt)</code>/<code>not(all)</code>;
            动作只打标记,是否拦截由判定策略另行配置。底部黑匣子实时显示 G1-G7 校验。
          </p>
        {:else}
          <!-- === json 模式 === -->
          <section class="json-section">
            <textarea
              class="json-textarea"
              bind:value={content}
              disabled={readonly}
              spellcheck="false"
              autocomplete="off"
              placeholder="在此输入完整规则 JSON..."
            ></textarea>
          </section>
        {/if}
      </main>
    </div>

    <!-- === 底部黑匣子 (90px) === -->
    <footer class="blackbox">
      <div class="blackbox-left">
        <span class="bb-label">CONTENT</span>
        <pre class="bb-preview">{content.slice(0, 280)}{content.length > 280 ? "…" : ""}</pre>
      </div>
      <div class="blackbox-right">
        <span class="bb-label">G1-G7</span>
        <div class="lamps">
          {#each gateStatus as g (g.gate)}
            <span
              class="lamp"
              class:passed={g.passed}
              class:failed={!g.passed}
              title={g.message ?? GATE_DESC[g.gate]}
            >
              <span class="lamp-icon">{g.passed ? "●" : "○"}</span>
              <span class="lamp-label">{g.gate}</span>
            </span>
          {/each}
        </div>
        <span class="bb-result" class:ok={validation.valid} class:bad={!validation.valid}>
          {validation.valid ? "✅ 全部通过" : "❌ 有失败项"}
        </span>
      </div>
    </footer>
  {/if}
</div>

<style>
  .editor-page {
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
  }

  /* === 顶部栏 === */
  .editor-topbar {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    padding: var(--spacing-sm) var(--spacing-lg);
    background: var(--bg-card);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .title-group {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    margin-right: auto;
  }

  .title-group h1 {
    margin: 0;
    font-size: var(--text-lg);
    color: var(--text-primary);
    font-family: var(--font-mono);
  }

  .state-badge {
    font-size: var(--text-xs);
    padding: 1px var(--spacing-sm);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    font-family: var(--font-mono);
    color: var(--text-secondary);
  }

  .state-badge.state-active {
    color: var(--success);
    border-color: var(--success);
  }
  .state-badge.state-draft {
    color: var(--warning);
    border-color: var(--warning);
  }
  .state-badge.state-blocked {
    color: var(--danger);
    border-color: var(--danger);
  }

  .readonly-tag {
    font-size: var(--text-xs);
    padding: 1px var(--spacing-sm);
    border: 1px solid var(--text-secondary);
    border-radius: var(--radius-sm);
    color: var(--text-secondary);
  }

  .mode-switch {
    display: inline-flex;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .mode-btn {
    padding: var(--spacing-xs) var(--spacing-md);
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: var(--text-sm);
    color: var(--text-secondary);
    font-family: var(--font-sans);
  }

  .mode-btn.active {
    background: var(--brand);
    color: #ffffff;
  }

  .topbar-actions {
    display: flex;
    gap: var(--spacing-sm);
  }

  /* === 主体 === */
  .editor-body {
    display: grid;
    grid-template-columns: 30% 1fr;
    flex: 1;
    overflow: hidden;
    min-height: 0;
  }

  /* === 左侧缩略列表 === */
  .rule-thumbs {
    display: flex;
    flex-direction: column;
    background: var(--bg-card);
    border-right: 1px solid var(--border);
    overflow: hidden;
  }

  .thumbs-header {
    padding: var(--spacing-sm) var(--spacing-md);
    border-bottom: 1px solid var(--border);
  }

  .thumbs-header h2 {
    margin: 0;
    font-size: var(--text-xs);
    color: var(--text-secondary);
    font-weight: var(--font-medium);
    text-transform: uppercase;
  }

  .thumbs-list {
    flex: 1;
    overflow-y: auto;
    padding: var(--spacing-xs);
  }

  .thumb-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    width: 100%;
    padding: var(--spacing-xs) var(--spacing-sm);
    background: transparent;
    border: none;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-size: var(--text-xs);
    color: var(--text-primary);
    text-align: left;
    font-family: var(--font-mono);
  }

  .thumb-item:hover {
    background: var(--bg-hover);
  }

  .thumb-item.active {
    background: color-mix(in srgb, var(--brand) 12%, var(--bg-card));
    color: var(--brand);
  }

  .state-dot {
    width: 8px;
    height: 8px;
    border-radius: var(--radius-full);
    flex-shrink: 0;
    display: inline-block;
  }

  .thumb-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* === 右侧编辑区 === */
  .edit-area {
    overflow-y: auto;
    padding: var(--spacing-md) var(--spacing-lg);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }

  .save-msg {
    padding: var(--spacing-sm) var(--spacing-md);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    color: var(--text-primary);
  }

  .save-msg.ok {
    border-color: var(--success);
    color: var(--success);
  }
  .save-msg.warn {
    border-color: var(--warning);
    color: var(--warning);
  }
  .save-msg.err {
    border-color: var(--danger);
    color: var(--danger);
  }

  .unsupported-banner {
    padding: var(--spacing-sm) var(--spacing-md);
    background: color-mix(in srgb, var(--warning) 8%, var(--bg-card));
    border: 1px solid var(--warning);
    border-radius: var(--radius-md);
    font-size: var(--text-xs);
    color: var(--text-primary);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .unsupported-banner strong {
    color: var(--warning);
  }

  .unsupported-reason {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--text-secondary);
    word-break: break-all;
  }

  /* === form 模式 === */
  .form-section {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .section-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .form-title {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--text-primary);
    font-weight: var(--font-semibold);
  }

  .form-row {
    display: flex;
    gap: var(--spacing-sm);
    align-items: flex-end;
  }

  .form-row-cond {
    align-items: center;
    padding: var(--spacing-xs) 0;
    border-bottom: 1px solid var(--border);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    flex: 1;
  }

  .field-grow {
    flex: 2;
  }

  .field-label {
    font-size: var(--text-xs);
    color: var(--text-secondary);
    font-weight: var(--font-medium);
  }

  .cond-field {
    flex: 2 1 120px;
    min-width: 0;
    font-family: var(--font-mono);
    font-size: var(--text-xs);
  }

  .cond-op {
    flex: 0 0 110px;
    min-width: 0;
    font-family: var(--font-mono);
    font-size: var(--text-xs);
  }

  .cond-value {
    flex: 1 1 80px;
    min-width: 0;
    font-family: var(--font-mono);
    font-size: var(--text-xs);
  }

  .cond-value-wide {
    flex: 2 1 140px;
  }

  .form-row-cond select {
    width: 100%;
    font-size: var(--text-xs);
    font-family: var(--font-mono);
  }

  .translation-preview {
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: var(--spacing-sm) var(--spacing-md);
    font-size: var(--text-sm);
    color: var(--text-primary);
    font-family: var(--font-mono);
  }

  .btn-mini {
    padding: 2px var(--spacing-sm);
    font-size: var(--text-xs);
    background: transparent;
    color: var(--text-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-family: var(--font-sans);
  }

  .btn-mini:hover:not(:disabled) {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .btn-remove {
    color: var(--danger);
    border-color: var(--danger);
  }

  .empty-mini {
    margin: 0;
    padding: var(--spacing-sm);
    color: var(--text-secondary);
    font-size: var(--text-xs);
    text-align: center;
  }

  .form-hint {
    margin: 0;
    padding: var(--spacing-sm);
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    font-size: var(--text-xs);
    color: var(--text-secondary);
  }

  .form-hint code {
    font-family: var(--font-mono);
    background: var(--bg-hover);
    padding: 1px 4px;
    border-radius: var(--radius-sm);
  }

  /* === json 模式 === */
  .json-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .json-textarea {
    flex: 1;
    width: 100%;
    min-height: 400px;
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    line-height: var(--leading-mono);
    padding: var(--spacing-md);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    resize: none;
    white-space: pre;
    overflow: auto;
    tab-size: 2;
  }

  .json-textarea:focus {
    outline: none;
    border-color: var(--brand);
    box-shadow: var(--focus-ring);
  }

  .json-textarea:disabled {
    background: var(--bg-primary);
    color: var(--text-secondary);
    cursor: not-allowed;
  }

  /* === 底部黑匣子 === */
  .blackbox {
    display: flex;
    gap: var(--spacing-md);
    height: 90px;
    padding: var(--spacing-sm) var(--spacing-lg);
    background: var(--bg-card);
    border-top: 1px solid var(--border);
    flex-shrink: 0;
    overflow: hidden;
  }

  .blackbox-left {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .blackbox-right {
    width: 360px;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    flex-shrink: 0;
  }

  .bb-label {
    font-size: 10px;
    color: var(--text-secondary);
    font-weight: var(--font-medium);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .bb-preview {
    flex: 1;
    margin: 0;
    font-family: var(--font-mono);
    font-size: 10px;
    line-height: 1.4;
    color: var(--text-secondary);
    overflow: hidden;
    white-space: pre;
    text-overflow: ellipsis;
  }

  .lamps {
    display: flex;
    gap: var(--spacing-xs);
    flex-wrap: wrap;
  }

  .lamp {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    font-family: var(--font-mono);
    font-size: 10px;
  }

  .lamp.passed {
    color: var(--success);
  }

  .lamp.failed {
    color: var(--danger);
  }

  .lamp-icon {
    font-size: 10px;
  }

  .bb-result {
    font-size: var(--text-xs);
    font-family: var(--font-mono);
    font-weight: var(--font-medium);
  }

  .bb-result.ok {
    color: var(--success);
  }
  .bb-result.bad {
    color: var(--danger);
  }

  /* === 空态 === */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    gap: var(--spacing-md);
    color: var(--text-secondary);
  }

  @media (max-width: 900px) {
    .editor-body {
      grid-template-columns: 1fr;
    }
    .rule-thumbs {
      display: none;
    }
    .blackbox-right {
      width: 200px;
    }
  }
</style>
