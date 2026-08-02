<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (C) 2026 EvoRule Project -->
<!-- evorule-console 规则库视图 — 展现 evorule "规则即数据" -->
<!--
  依据: docs/SPEC.md §2.1, §3
  职责:
    - 加载 / 编辑 / 保存 JSON 规则(本地,不调后端)
    - 规则列表 + 详情 + 编辑器(JSON 语法)
    - 实时 G1-G7 预校验(对齐核心仓 T1/T2/D2)
    - 导入 / 导出 JSON 文件

  不做:
    - 不调 evorule-server(基础版无网络)
    - 不做 LLM 集成(基础版不含 AI)
-->

<script lang="ts">
  import {
    rules,
    selectedRuleId,
    selectedRule,
    selectRule,
    addRule,
    updateRule,
    duplicateRule,
    deleteRule,
    importRule,
    exportRule,
  } from "$lib/stores/rules";
  import RuleEditor from "./RuleEditor.svelte";

  let showEditor = $state(false);
  let editorMode = $state<"create" | "edit">("create");
  let editorInitialContent = $state("");
  let editorRuleId = $state<string | null>(null);
  let errorMsg = $state<string | null>(null);
  let fileInput = $state<HTMLInputElement | null>(null);

  function handleNewRule() {
    editorMode = "create";
    editorInitialContent = JSON.stringify(
      {
        id: "user.new_rule",
        version: 1,
        description: "新建规则 — 描述业务意图",
        transform: [
          {
            type: "set",
            params: { attr: "__exec__.payload.x", operation: "set", value: 0 },
          },
          {
            type: "branch",
            params: { domain: { type: "all", domains: [] }, on_true: [] },
          },
        ],
      },
      null,
      2,
    );
    editorRuleId = null;
    showEditor = true;
  }

  function handleEdit() {
    const rule = $selectedRule;
    if (!rule) return;
    if (rule.source === "builtin") {
      // builtin 规则:复制一份再编辑(保护内置示例)
      editorRuleId = duplicateRule(rule.id);
    } else {
      editorRuleId = rule.id;
    }
    editorMode = "edit";
    editorInitialContent = rule.content;
    showEditor = true;
  }

  function handleDelete() {
    const rule = $selectedRule;
    if (!rule) return;
    if (rule.source === "builtin") {
      errorMsg = `内置规则 "${rule.id}" 不可删除`;
      setTimeout(() => (errorMsg = null), 3000);
      return;
    }
    if (!confirm(`确认删除规则 "${rule.id}"?此操作不可撤销。`)) return;
    try {
      deleteRule(rule.id);
    } catch (e) {
      errorMsg = (e as Error).message;
      setTimeout(() => (errorMsg = null), 3000);
    }
  }

  function handleImportClick() {
    fileInput?.click();
  }

  function handleFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const content = reader.result as string;
        importRule(content);
        errorMsg = null;
      } catch (e) {
        errorMsg = (e as Error).message;
        setTimeout(() => (errorMsg = null), 5000);
      }
    };
    reader.onerror = () => {
      errorMsg = "文件读取失败";
      setTimeout(() => (errorMsg = null), 5000);
    };
    reader.readAsText(file);
    // 清空 input 让同一文件可再次选择
    input.value = "";
  }

  function handleExport() {
    const rule = $selectedRule;
    if (!rule) return;
    try {
      const content = exportRule(rule.id);
      const blob = new Blob([content], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${rule.id.replace(/[^\w.-]/g, "_")}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      errorMsg = (e as Error).message;
      setTimeout(() => (errorMsg = null), 5000);
    }
  }

  function handleEditorSave(
    content: string,
    description: string,
    version: number,
  ) {
    try {
      if (editorMode === "create") {
        // 解析获取 id(JSON 内 id 字段)
        const parsed = JSON.parse(content);
        const id = `user.${parsed.id ?? "rule_" + Date.now()}`;
        addRule({ id, version, description, content });
      } else if (editorRuleId) {
        updateRule(editorRuleId, { content, description, version });
      }
      showEditor = false;
      errorMsg = null;
    } catch (e) {
      errorMsg = (e as Error).message;
      setTimeout(() => (errorMsg = null), 5000);
    }
  }

  function handleEditorCancel() {
    showEditor = false;
  }

  function handleSelectRule(id: string) {
    selectRule(id);
  }

  function formatTimestamp(iso: string): string {
    try {
      return new Date(iso).toLocaleString("zh-CN");
    } catch {
      return iso;
    }
  }
</script>

<div class="rule-library">
  <header class="library-header">
    <div class="title-group">
      <h1>规则库</h1>
      <span class="subtitle">规则即数据 — 业务专家可读可改</span>
    </div>
    <div class="actions">
      <button class="btn btn-primary" onclick={handleNewRule}>
        <span class="btn-icon">+</span>
        新建规则
      </button>
      <button class="btn" onclick={handleImportClick}>
        <span class="btn-icon">↑</span>
        导入
      </button>
      <input
        bind:this={fileInput}
        type="file"
        accept=".json,application/json"
        onchange={handleFileSelected}
        style="display:none"
      />
    </div>
  </header>

  {#if errorMsg}
    <div class="error-banner" role="alert">
      <span class="error-icon">⚠</span>
      <span>{errorMsg}</span>
      <button class="error-close" onclick={() => (errorMsg = null)}>✕</button>
    </div>
  {/if}

  <div class="library-body">
    <aside class="rule-list">
      <div class="list-header">
        <span>规则列表 ({$rules.length})</span>
      </div>
      {#each $rules as rule (rule.id)}
        <button
          class="rule-item"
          class:selected={$selectedRuleId === rule.id}
          onclick={() => handleSelectRule(rule.id)}
        >
          <div class="rule-item-id">{rule.id}</div>
          <div class="rule-item-desc">{rule.description}</div>
          <div class="rule-item-meta">
            <span class="badge badge-{rule.source}"
              >{rule.source === "builtin" ? "内置" : "用户"}</span
            >
            <span class="version">v{rule.version}</span>
          </div>
        </button>
      {/each}
      {#if $rules.length === 0}
        <div class="empty-state">
          <span class="empty-icon">📋</span>
          <p>暂无规则</p>
          <p class="empty-hint">点击"新建规则"或"导入"开始</p>
        </div>
      {/if}
    </aside>

    <main class="rule-detail">
      {#if $selectedRule}
        {@const rule = $selectedRule}
        <header class="detail-header">
          <div>
            <h2 class="rule-id">{rule.id}</h2>
            <span class="badge badge-{rule.source}">
              {rule.source === "builtin" ? "内置示例" : "用户规则"}
            </span>
          </div>
          <div class="detail-actions">
            <button class="btn btn-primary" onclick={handleEdit}>
              {rule.source === "builtin" ? "复制并编辑" : "编辑"}
            </button>
            <button class="btn" onclick={handleExport}>导出</button>
            {#if rule.source === "user"}
              <button class="btn btn-danger" onclick={handleDelete}>删除</button
              >
            {/if}
          </div>
        </header>

        <dl class="detail-meta">
          <div class="meta-row">
            <dt>描述</dt>
            <dd>{rule.description}</dd>
          </div>
          <div class="meta-row">
            <dt>版本</dt>
            <dd>v{rule.version}</dd>
          </div>
          <div class="meta-row">
            <dt>创建</dt>
            <dd>{formatTimestamp(rule.createdAt)}</dd>
          </div>
          <div class="meta-row">
            <dt>更新</dt>
            <dd>{formatTimestamp(rule.updatedAt)}</dd>
          </div>
        </dl>

        <section class="detail-content">
          <header class="content-header">规则内容 (JSON)</header>
          <pre class="rule-json">{rule.content}</pre>
        </section>
      {:else}
        <div class="empty-state">
          <span class="empty-icon">👈</span>
          <p>从左侧选择一个规则</p>
        </div>
      {/if}
    </main>
  </div>
</div>

{#if showEditor}
  <RuleEditor
    mode={editorMode}
    ruleId={editorRuleId}
    initialContent={editorInitialContent}
    onsave={handleEditorSave}
    oncancel={handleEditorCancel}
  />
{/if}

<style>
  .rule-library {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }

  .library-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-md) var(--spacing-lg);
    border-bottom: 1px solid var(--color-gray-200);
    background: var(--color-gray-50);
  }

  .title-group h1 {
    margin: 0;
    font-size: var(--text-xl);
    color: var(--color-gray-900);
  }

  .subtitle {
    font-size: var(--text-xs);
    color: var(--color-gray-500);
    margin-left: var(--spacing-sm);
  }

  .actions {
    display: flex;
    gap: var(--spacing-sm);
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-xs);
    padding: var(--spacing-sm) var(--spacing-md);
    border: 1px solid var(--color-gray-300);
    background: white;
    color: var(--color-gray-700);
    border-radius: var(--radius-md);
    cursor: pointer;
    font-size: var(--text-sm);
    transition: all var(--transition-fast);
  }

  .btn:hover {
    background: var(--color-gray-100);
    border-color: var(--color-gray-400);
  }

  .btn-primary {
    background: var(--color-primary);
    border-color: var(--color-primary);
    color: white;
  }

  .btn-primary:hover {
    background: var(--color-primary-hover);
    border-color: var(--color-primary-hover);
  }

  .btn-danger {
    color: var(--color-error);
    border-color: var(--color-error);
  }

  .btn-danger:hover {
    background: var(--color-error);
    color: white;
  }

  .btn-icon {
    font-weight: 600;
  }

  .error-banner {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    background: #fef2f2;
    border-bottom: 1px solid #fecaca;
    color: var(--color-error);
    font-size: var(--text-sm);
  }

  .error-close {
    margin-left: auto;
    background: transparent;
    border: none;
    color: var(--color-error);
    cursor: pointer;
    font-size: var(--text-base);
  }

  .library-body {
    flex: 1;
    display: grid;
    grid-template-columns: 320px 1fr;
    overflow: hidden;
    min-height: 0;
  }

  .rule-list {
    border-right: 1px solid var(--color-gray-200);
    overflow-y: auto;
    background: white;
  }

  .list-header {
    padding: var(--spacing-sm) var(--spacing-md);
    font-size: var(--text-xs);
    color: var(--color-gray-500);
    font-weight: 600;
    text-transform: uppercase;
    background: var(--color-gray-50);
    border-bottom: 1px solid var(--color-gray-200);
    position: sticky;
    top: 0;
    z-index: 1;
  }

  .rule-item {
    display: block;
    width: 100%;
    text-align: left;
    padding: var(--spacing-sm) var(--spacing-md);
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--color-gray-100);
    cursor: pointer;
    transition: background var(--transition-fast);
  }

  .rule-item:hover {
    background: var(--color-gray-50);
  }

  .rule-item.selected {
    background: #eef2ff;
    border-left: 3px solid var(--color-primary);
    padding-left: calc(var(--spacing-md) - 3px);
  }

  .rule-item-id {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    color: var(--color-gray-900);
    font-weight: 600;
    margin-bottom: 2px;
  }

  .rule-item-desc {
    font-size: var(--text-xs);
    color: var(--color-gray-600);
    line-height: 1.4;
    margin-bottom: var(--spacing-xs);
  }

  .rule-item-meta {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .badge {
    display: inline-block;
    font-size: 10px;
    padding: 2px 6px;
    border-radius: var(--radius-sm);
    font-weight: 600;
  }

  .badge-builtin {
    background: var(--color-gray-200);
    color: var(--color-gray-700);
  }

  .badge-user {
    background: #d1fae5;
    color: #065f46;
  }

  .version {
    font-size: 10px;
    color: var(--color-gray-500);
  }

  .rule-detail {
    overflow-y: auto;
    padding: var(--spacing-lg);
    background: white;
    min-width: 0;
  }

  .detail-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: var(--spacing-lg);
  }

  .rule-id {
    font-family: var(--font-mono);
    font-size: var(--text-lg);
    margin: 0 0 var(--spacing-xs) 0;
    color: var(--color-gray-900);
  }

  .detail-actions {
    display: flex;
    gap: var(--spacing-sm);
  }

  .detail-meta {
    margin: 0 0 var(--spacing-lg) 0;
    padding: var(--spacing-md);
    background: var(--color-gray-50);
    border-radius: var(--radius-md);
  }

  .meta-row {
    display: grid;
    grid-template-columns: 80px 1fr;
    padding: var(--spacing-xs) 0;
    font-size: var(--text-sm);
  }

  .meta-row dt {
    color: var(--color-gray-500);
  }

  .meta-row dd {
    margin: 0;
    color: var(--color-gray-900);
  }

  .detail-content {
    border: 1px solid var(--color-gray-200);
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .content-header {
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--color-gray-100);
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--color-gray-600);
    text-transform: uppercase;
    border-bottom: 1px solid var(--color-gray-200);
  }

  .rule-json {
    margin: 0;
    padding: var(--spacing-md);
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    line-height: 1.6;
    color: var(--color-gray-900);
    overflow-x: auto;
    white-space: pre;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: var(--spacing-2xl);
    color: var(--color-gray-500);
    text-align: center;
  }

  .empty-icon {
    font-size: 48px;
    margin-bottom: var(--spacing-md);
  }

  .empty-hint {
    font-size: var(--text-xs);
    margin-top: var(--spacing-xs);
  }

  @media (max-width: 768px) {
    .library-body {
      grid-template-columns: 1fr;
    }
    .rule-list {
      max-height: 200px;
    }
  }
</style>
