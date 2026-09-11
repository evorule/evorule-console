<!--
  SPDX-License-Identifier: AGPL-3.0-or-later
  Copyright (C) 2026 EvoRule Project
  evorule-console 工作空间路由 (阶段 D.1.1)
-->
<!--
  依据: 设计文档/01_界面升级.txt §三.1 (工作空间页线框)
        实施文档_界面升级_v1.0.md §D.1.1
  职责:
    - 顶部导航: Logo + workspace 下拉 + 试运行/发布按钮
    - 4 指标卡: 规则总数 / 已发布版本 / 未发布草稿 / 沙盒测试中
    - 规则列表: div 行 (8px 状态点 + 规则名 + 业务对象标签 + 相对时间 + 右箭头)
    - 迁移横幅: 保留 (旧 localStorage → server)
  数据源:
    - refreshWorkspaces (自动 ensureDefaultWorkspace + 种入示例)
    - refreshRules (currentWorkspaceId 变化时)
    - refreshProductionState + refreshSandboxes (onMount 补齐,供指标卡)
  交互:
    - 点击规则行 → goto('/workspace/editor/${id}')
    - workspace 下拉切换 → selectWorkspace
    - 新建规则 → goto('/workspace/editor/new')
-->

<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import {
    workspaces,
    currentWorkspace,
    currentWorkspaceId,
    workspaceSandboxes,
    productionState,
    isLoading,
    lastError,
    selectWorkspace,
    refreshProductionState,
    refreshSandboxes,
  } from "$lib/stores/workspace";
  import {
    rules,
    migrationNeeded,
    refreshRules,
    checkMigrationNeeded,
    migrateLegacyRules,
    isRuleReadonly,
  } from "$lib/stores/rules";
  import { useWorkspaceBackendOrNull } from "$lib/backend/workspace-context";
  import type { Rule, RuleState } from "$lib/stores/rules";

  const backend = useWorkspaceBackendOrNull();

  let migrating = $state(false);
  let migrateResult = $state<string | null>(null);

  onMount(() => {
    if (!backend) return;
    // refreshWorkspaces 已上移至 +layout.svelte(布局级水合,所有路由共享)
    checkMigrationNeeded();
    // 指标卡数据源 (生产状态是全局单行表,不依赖 workspace)
    refreshProductionState(backend);
  });

  // 当 currentWorkspaceId 变化时刷新规则列表 + 沙盒列表
  $effect(() => {
    const wsId = $currentWorkspaceId;
    if (wsId && backend) {
      refreshRules(backend, wsId);
      refreshSandboxes(backend, wsId);
    }
  });

  // === 指标卡派生数据 ===
  /** 规则总数 */
  let totalRules = $derived($rules.length);
  /** 已发布版本 (生产状态单行表的 ruleset_version) */
  let publishedVersion = $derived($productionState?.ruleset_version ?? 0);
  /** 未发布草稿数 (state === 'draft') */
  let draftCount = $derived(
    $rules.filter((r) => r.state === "draft").length,
  );
  /** 沙盒测试中数 (status === 'running') */
  let sandboxRunning = $derived(
    $workspaceSandboxes.filter((s) => s.status === "running").length,
  );

  async function handleMigrate() {
    if (!backend || !$currentWorkspaceId) return;
    if (
      !confirm(
        "将把旧 localStorage 规则迁移到 server workspace,旧数据会备份保留。继续?",
      )
    )
      return;
    migrating = true;
    migrateResult = null;
    try {
      const result = await migrateLegacyRules(backend, $currentWorkspaceId);
      migrateResult = `迁移完成:成功 ${result.migrated} 条,失败 ${result.failed} 条`;
    } catch (e) {
      migrateResult = `迁移失败: ${(e as Error).message}`;
    } finally {
      migrating = false;
    }
  }

  async function handleWorkspaceChange(e: Event) {
    if (!backend) return;
    const target = e.target as HTMLSelectElement;
    const id = target.value;
    if (id) await selectWorkspace(backend, id);
  }

  function handleNewRule() {
    goto("/workspace/editor/new");
  }

  function handleSelectRule(rule: Rule) {
    goto(`/workspace/editor/${rule.id}`);
  }

  /** 相对时间 (xx 前) */
  function relativeTime(iso: string): string {
    try {
      const t = new Date(iso).getTime();
      const now = Date.now();
      const diff = now - t;
      if (diff < 0) return "刚刚";
      const min = Math.floor(diff / 60000);
      if (min < 1) return "刚刚";
      if (min < 60) return `${min} 分钟前`;
      const hr = Math.floor(min / 60);
      if (hr < 24) return `${hr} 小时前`;
      const day = Math.floor(hr / 24);
      if (day < 30) return `${day} 天前`;
      return new Date(iso).toLocaleDateString("zh-CN");
    } catch {
      return iso;
    }
  }

  const STATE_LABEL: Record<RuleState, string> = {
    draft: "草稿",
    candidate: "候选",
    active: "活跃",
    blocked: "阻塞",
    archived: "归档",
  };

  /** 状态点颜色 (对齐设计令牌) */
  const STATE_TONE: Record<RuleState, string> = {
    draft: "var(--warning)",
    candidate: "var(--brand)",
    active: "var(--success)",
    blocked: "var(--danger)",
    archived: "var(--text-secondary)",
  };

  /** 业务对象标签: 从 metadata 或 name 派生 (简化版) */
  function bizTag(rule: Rule): string {
    if (rule.name.startsWith("example.")) return "示例";
    if (rule.state === "draft") return "编辑中";
    return rule.description ? rule.description.slice(0, 8) : "—";
  }
</script>

<div class="workspace-page">
  <!-- === 顶部导航 === -->
  <header class="ws-topbar">
    <div class="brand">
      <span class="brand-mark">evorule</span>
      <span class="brand-sep">/</span>
      <span class="brand-section">工作空间</span>
    </div>

    <div class="ws-selector">
      <label for="ws-select" class="ws-select-label">当前空间</label>
      <select
        id="ws-select"
        class="ws-select"
        value={$currentWorkspaceId ?? ""}
        onchange={handleWorkspaceChange}
        disabled={$workspaces.length === 0}
      >
        {#each $workspaces as ws (ws.id)}
          <option value={ws.id}>{ws.name}</option>
        {/each}
        {#if $workspaces.length === 0}
          <option value="">(无工作空间)</option>
        {/if}
      </select>
    </div>

    <div class="topbar-actions">
      <button class="btn-secondary" onclick={() => goto("/workspace/templates")}>
        插件模板
      </button>
      <button class="btn-secondary" disabled={!$currentWorkspace}>试运行</button>
      <button class="btn-secondary" disabled={!$currentWorkspace}>发布</button>
      <button class="btn-primary" onclick={handleNewRule} disabled={!$currentWorkspace}>
        + 新建规则
      </button>
    </div>
  </header>

  {#if $lastError}
    <div class="error-banner" role="alert">
      <span>⚠</span>
      <span>{$lastError}</span>
    </div>
  {/if}

  {#if $migrationNeeded}
    <div class="migrate-banner">
      <div class="migrate-content">
        <span class="migrate-icon">📦</span>
        <div>
          <strong>检测到旧版规则数据</strong>
          <p>检测到 localStorage 中的旧版规则,建议迁移到 server workspace。</p>
          {#if migrateResult}
            <p class="migrate-result">{migrateResult}</p>
          {/if}
        </div>
      </div>
      <button class="btn-secondary" onclick={handleMigrate} disabled={migrating || !$currentWorkspace}>
        {migrating ? "迁移中…" : "一键迁移"}
      </button>
    </div>
  {/if}

  <!-- === 4 指标卡 === -->
  <section class="metrics-grid" aria-label="工作空间指标">
    <div class="metric-card">
      <span class="metric-label">规则总数</span>
      <span class="metric-value" class:loading={$isLoading && totalRules === 0}>
        {totalRules}
      </span>
      <span class="metric-unit">条</span>
    </div>
    <div class="metric-card">
      <span class="metric-label">已发布版本</span>
      <span class="metric-value">v{publishedVersion}</span>
      <span class="metric-unit">生产态</span>
    </div>
    <div class="metric-card" class:accent={draftCount > 0}>
      <span class="metric-label">未发布草稿</span>
      <span class="metric-value">{draftCount}</span>
      <span class="metric-unit">待提交</span>
    </div>
    <div class="metric-card" class:accent={sandboxRunning > 0}>
      <span class="metric-label">沙盒测试中</span>
      <span class="metric-value">{sandboxRunning}</span>
      <span class="metric-unit">running</span>
    </div>
  </section>

  <!-- === 规则列表 === -->
  <section class="rules-section">
    <header class="section-header">
      <h2>规则列表</h2>
      <span class="section-hint">点击规则进入编辑器</span>
    </header>

    {#if $rules.length === 0}
      <div class="empty-state">
        <span class="empty-icon">📋</span>
        <p>暂无规则</p>
        <p class="empty-hint">
          {#if $currentWorkspace}
            首次启动应自动种入 3 条示例规则;若为空,请确认 server 已启动
          {:else}
            等待工作空间初始化…
          {/if}
        </p>
      </div>
    {:else}
      <div class="rules-list">
        {#each $rules as rule (rule.id)}
          <button
            class="rule-row"
            onclick={() => handleSelectRule(rule)}
          >
            <span
              class="state-dot"
              style="background: {STATE_TONE[rule.state]}"
              title={STATE_LABEL[rule.state]}
              aria-label="状态: {STATE_LABEL[rule.state]}"
            ></span>
            <span class="rule-name">{rule.name}</span>
            {#if isRuleReadonly(rule)}
              <span class="biz-tag tag-readonly">只读</span>
            {:else}
              <span class="biz-tag">{bizTag(rule)}</span>
            {/if}
            <span class="rule-version">
              {rule.version !== undefined ? `v${rule.version}` : "—"}
            </span>
            <span class="rule-time" title={rule.updatedAt}>
              {relativeTime(rule.updatedAt)}
            </span>
            <span class="row-arrow" aria-hidden="true">›</span>
          </button>
        {/each}
      </div>
    {/if}
  </section>
</div>

<style>
  .workspace-page {
    padding: var(--spacing-lg);
    max-width: 1200px;
    margin: 0 auto;
  }

  /* === 顶部导航 === */
  .ws-topbar {
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

  .ws-selector {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    margin-right: auto;
  }

  .ws-select-label {
    font-size: var(--text-xs);
    color: var(--text-secondary);
    font-weight: var(--font-medium);
  }

  .ws-select {
    min-width: 200px;
    font-size: var(--text-sm);
  }

  .topbar-actions {
    display: flex;
    gap: var(--spacing-sm);
  }

  /* === 错误横幅 === */
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

  /* === 迁移横幅 === */
  .migrate-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-md);
    padding: var(--spacing-md);
    background: color-mix(in srgb, var(--warning) 8%, var(--bg-card));
    border: 1px solid var(--warning);
    border-radius: var(--radius-md);
    margin-bottom: var(--spacing-md);
  }

  .migrate-content {
    display: flex;
    gap: var(--spacing-sm);
    align-items: flex-start;
  }

  .migrate-icon {
    font-size: var(--text-xl);
  }

  .migrate-content strong {
    color: var(--text-primary);
    font-size: var(--text-sm);
  }

  .migrate-content p {
    margin: 4px 0 0 0;
    font-size: var(--text-xs);
    color: var(--text-secondary);
  }

  .migrate-result {
    color: var(--text-primary);
    font-weight: var(--font-medium);
  }

  /* === 4 指标卡 === */
  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--spacing-md);
    margin-bottom: var(--spacing-lg);
  }

  .metric-card {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    padding: var(--spacing-md);
    background: var(--bg-card);
    border: var(--card-border);
    border-radius: var(--radius-md);
  }

  .metric-card.accent {
    border-color: var(--brand);
  }

  .metric-label {
    font-size: var(--text-xs);
    color: var(--text-secondary);
    font-weight: var(--font-medium);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .metric-value {
    font-family: var(--font-mono);
    font-size: var(--text-2xl);
    font-weight: var(--font-semibold);
    color: var(--text-primary);
    line-height: var(--leading-tight);
  }

  .metric-value.loading {
    color: var(--text-secondary);
  }

  .metric-unit {
    font-size: var(--text-xs);
    color: var(--text-secondary);
  }

  /* === 规则列表区 === */
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: var(--spacing-sm);
  }

  .section-header h2 {
    margin: 0;
    font-size: var(--text-base);
    color: var(--text-primary);
    font-weight: var(--font-semibold);
  }

  .section-hint {
    font-size: var(--text-xs);
    color: var(--text-secondary);
  }

  .rules-list {
    display: flex;
    flex-direction: column;
    background: var(--bg-card);
    border: var(--card-border);
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .rule-row {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    width: 100%;
    padding: var(--spacing-sm) var(--spacing-md);
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--border);
    cursor: pointer;
    font-family: var(--font-sans);
    font-size: var(--text-sm);
    color: var(--text-primary);
    text-align: left;
    transition: background var(--transition-fast);
  }

  .rule-row:last-child {
    border-bottom: none;
  }

  .rule-row:hover {
    background: var(--bg-hover);
  }

  .rule-row:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
    z-index: 1;
  }

  .state-dot {
    width: 8px;
    height: 8px;
    border-radius: var(--radius-full);
    flex-shrink: 0;
    display: inline-block;
  }

  .rule-name {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    color: var(--text-primary);
    font-weight: var(--font-medium);
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .biz-tag {
    flex-shrink: 0;
    font-size: var(--text-xs);
    padding: 1px var(--spacing-sm);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--text-secondary);
    background: var(--bg-primary);
  }

  .biz-tag.tag-readonly {
    color: var(--text-secondary);
    border-color: var(--text-secondary);
  }

  .rule-version {
    flex-shrink: 0;
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--text-secondary);
    min-width: 48px;
    text-align: right;
  }

  .rule-time {
    flex-shrink: 0;
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--text-secondary);
    min-width: 80px;
    text-align: right;
  }

  .row-arrow {
    flex-shrink: 0;
    color: var(--text-secondary);
    font-size: var(--text-lg);
    line-height: 1;
  }

  /* === 空态 === */
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
    .metrics-grid {
      grid-template-columns: repeat(2, 1fr);
    }
    .rule-time {
      display: none;
    }
  }

  @media (max-width: 600px) {
    .ws-topbar {
      gap: var(--spacing-sm);
    }
    .ws-select {
      min-width: 140px;
    }
    .biz-tag {
      display: none;
    }
  }
</style>
