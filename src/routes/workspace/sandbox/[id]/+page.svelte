<!--
  SPDX-License-Identifier: AGPL-3.0-or-later
  Copyright (C) 2026 EvoRule Project
  evorule-console 试运行结果路由 (阶段 D.2.2)
-->
<!--
  依据: 设计文档/01_界面升级.txt §2.7 (试运行结果页, v2.0 修订)
        设计文档/06_试运行结果页.txt (线框参考, 已按 v2.0 修订去掉"匹配规则"节点)
        实施文档_界面升级_v1.0.md §D.2.2
  职责:
    - 顶部导航 (56px): ← 返回编辑 + "试运行结果" + 🧪 沙盒 | 执行 ID · 耗时(应用层非确定性)
    - 输入摘要: 沙盒元信息 (草稿规则集 hash / 数据集 / 启动者)
    - 因果链 4 节点: 输入 → Fact 流 → 最终状态 → 判定结果 (无"匹配规则"节点, 独立立项)
    - 详情区: Fact 流详情 (类型/逻辑版本号) + 命中规则占位
    - 底部: 返回修改 / 通过可发布 / 重新测试
  数据源:
    - WorkspaceBackend.getSandbox → SandboxSession (元信息 + tcb_session_id)
    - ExecutionBackend.getAudit/getReplay/verifyAudit → Fact 流 + 链完整性
    - WorkspaceBackend.evaluateVerdict → 判定结果 (应用层, 标注非确定性)
  边界:
    - 命中规则追溯 (rule_id 透传) 独立立项, 本次仅占位提示
    - sandbox Draft 规则缺陷独立立项, Fact 流可能为空 (页面优雅降级)
-->

<script lang="ts">
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import { currentWorkspaceId } from "$lib/stores/workspace";
  import { useWorkspaceBackendOrNull } from "$lib/backend/workspace-context";
  import { useBackendOrNull } from "$lib/backend/backend-context";
  import { VerdictBadge } from "$lib";
  import type {
    SandboxSession,
    EvaluateVerdictResult,
  } from "$lib/backend/workspace-types";
  import type {
    SessionAudit,
    VerifyResult,
    Fact,
  } from "$lib/backend/types";

  const wsBackend = useWorkspaceBackendOrNull();
  const execBackend = useBackendOrNull();

  let id = $derived(page.params.id);

  let sandbox = $state<SandboxSession | null>(null);
  let audit = $state<SessionAudit | null>(null);
  let facts = $state<Fact[]>([]);
  let verify = $state<VerifyResult | null>(null);
  let verdict = $state<EvaluateVerdictResult | null>(null);
  let loading = $state(true);
  let errorMsg = $state<string | null>(null);

  // === 派生 ===
  /** 链完整性 (audit.verified 或 verify.verified) */
  let chainVerified = $derived(
    (audit?.verified ?? false) || (verify?.verified ?? false)
  );

  /** 耗时 (closed_at - started_at, 应用层非确定性) */
  let durationMs = $derived.by(() => {
    if (!sandbox?.closed_at || !sandbox?.started_at) return null;
    const d =
      new Date(sandbox.closed_at).getTime() -
      new Date(sandbox.started_at).getTime();
    return Number.isNaN(d) ? null : d;
  });

  /** 判定结果 → VerdictBadge kind */
  let verdictKind = $derived(
    verdict?.verdict === "pass"
      ? ("verdict-pass" as const)
      : verdict?.verdict === "block"
        ? ("verdict-block" as const)
        : ("verdict-none" as const)
  );

  /** 最终 Fact (用于最终状态摘要) */
  let lastFact = $derived(facts.length > 0 ? facts[facts.length - 1] : null);

  // === 数据加载 ===
  // 响应式加载: 等 currentWorkspaceId 水合(布局级 refreshWorkspaces 异步恢复)
  // 后再拉取。直接访问 /workspace/sandbox/[id] 时 wsId 初始为 null,布局水合后
  // currentWorkspaceId 变化触发本 effect 重跑。
  let loadStartedFor: string | null = null;
  $effect(() => {
    const wsId = $currentWorkspaceId;
    const sandboxId = id;
    // 依赖读取(响应式追踪)
    void wsId;
    void sandboxId;
    if (!wsBackend || !execBackend) {
      errorMsg = "backend 未注入 (需要 evorule-server 跑在 127.0.0.1:18080)";
      loading = false;
      return;
    }
    if (!wsId) {
      // workspace 尚未水合,保持 loading 态等布局恢复后重跑
      return;
    }
    // 同一 wsId+sandboxId 不重复加载
    const key = `${wsId}:${sandboxId}`;
    if (loadStartedFor === key) return;
    loadStartedFor = key;
    void loadSandboxData(wsId, sandboxId);
  });

  async function loadSandboxData(wsId: string, sandboxId: string | undefined) {
    if (!wsBackend || !execBackend || !sandboxId) return;
    loading = true;
    errorMsg = null;
    try {
      sandbox = await wsBackend.getSandbox(wsId, Number(sandboxId));
      const tcbId = sandbox.tcb_session_id;
      if (tcbId !== null) {
        const [a, f, v] = await Promise.allSettled([
          execBackend.getAudit(tcbId),
          execBackend.getReplay(tcbId),
          execBackend.verifyAudit(tcbId),
        ]);
        if (a.status === "fulfilled") audit = a.value;
        if (f.status === "fulfilled") facts = f.value;
        if (v.status === "fulfilled") verify = v.value;

        // 判定结果 (best-effort: 无契约 / 无 payload 时可能失败, verdict=none)
        try {
          verdict = await wsBackend.evaluateVerdict(wsId, { payload: {} });
        } catch {
          verdict = null;
        }
      }
    } catch (e) {
      errorMsg = `加载沙盒失败: ${(e as Error).message}`;
    } finally {
      loading = false;
    }
  }

  // === 工具 ===
  function truncateHash(h: string | null | undefined, len = 12): string {
    if (!h) return "—";
    return h.length > len ? `${h.slice(0, len)}…` : h;
  }

  function factVersion(f: Fact): string {
    const v = (f as Record<string, unknown>).version;
    const lt = (f as Record<string, unknown>).logical_time;
    if (typeof v === "number") return `v${v}`;
    if (typeof lt === "number") return `v${lt}`;
    return `#${f.id}`;
  }

  function durationLabel(ms: number | null): string {
    if (ms === null) return "—";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  }

  // === 操作 ===
  function backToEditor() {
    goto("/workspace");
  }

  function retest() {
    // 重新测试: 重新加载当前沙盒数据
    loading = true;
    errorMsg = null;
    facts = [];
    audit = null;
    verify = null;
    verdict = null;
    // 触发 $effect 加载逻辑(简化:reload 页面)
    if (typeof location !== "undefined") location.reload();
  }

  async function approveForPublish() {
    // 通过可发布: 跳回工作空间 (实际 submitPublish 留待发布流程)
    goto("/workspace");
  }
</script>

<div class="sandbox-page">
  <!-- === 顶部导航 (56px) === -->
  <header class="topbar">
    <button class="back-link" onclick={backToEditor}>← 返回编辑</button>
    <span class="title">试运行结果</span>
    <span class="sandbox-badge">🧪 沙盒</span>
    <div class="spacer"></div>
    <span class="meta-info">
      执行 ID: #{sandbox?.tcb_session_id ?? id}
      {#if sandbox?.closed_at}
        · 耗时 {durationLabel(durationMs)}
      {/if}
      <span class="non-det" title="应用层时间(墙钟),非 evorule 确定性">❌ 非确定性</span>
    </span>
  </header>

  <!-- === 主体 === -->
  <div class="main">
    {#if loading}
      <div class="state-block">
        <span class="state-icon">⏳</span>
        <p>正在加载试运行结果…</p>
      </div>
    {:else if errorMsg}
      <div class="state-block error">
        <span class="state-icon">⚠️</span>
        <p>{errorMsg}</p>
        <button class="btn-secondary" onclick={backToEditor}>返回工作空间</button>
      </div>
    {:else if !sandbox}
      <div class="state-block">
        <span class="state-icon">📭</span>
        <p>未找到沙盒 #{id}</p>
        <button class="btn-secondary" onclick={backToEditor}>返回工作空间</button>
      </div>
    {:else}
      <!-- 输入摘要 -->
      <section class="input-summary">
        <span class="summary-label">📥 输入事件</span>
        <div class="event-data">
          <span class="pair"><span class="key">沙盒</span><span class="value">#{sandbox.id}</span></span>
          <span class="pair"><span class="key">启动者</span><span class="value">{sandbox.started_by}</span></span>
          <span class="pair"><span class="key">数据集</span><span class="value">#{sandbox.test_dataset_id}</span></span>
          <span class="pair"
            ><span class="key">草稿规则集</span
            ><span class="value mono">{truncateHash(sandbox.draft_ruleset_hash)}</span></span
          >
          <span class="pair"
            ><span class="key">状态</span
            ><span class="value" class:running={sandbox.status === "running"}
              >{sandbox.status === "running" ? "进行中" : "已关闭"}</span
            ></span
          >
        </div>
      </section>

      <!-- 因果链 (4 节点, 无"匹配规则") -->
      <section class="causal-chain">
        <!-- 节点 1: 输入 -->
        <div class="chain-node">
          <div class="node-title">📌 输入</div>
          <div class="node-body">
            <div class="item"><span class="tag">事件</span> 沙盒试运行 <span class="val">#{sandbox.id}</span></div>
            <div class="item"><span class="tag">TCB会话</span> <span class="val">#{sandbox.tcb_session_id ?? "—"}</span></div>
            <div class="item"><span class="tag">数据集</span> #{sandbox.test_dataset_id}</div>
          </div>
        </div>

        <div class="chain-arrow">→</div>

        <!-- 节点 2: Fact 流 -->
        <div class="chain-node">
          <div class="node-title">📤 Fact 流</div>
          <div class="node-body">
            {#if facts.length > 0}
              {#each facts.slice(0, 5) as f}
                <div class="item"
                  ><span class="tag">{f.type}</span> <span class="val">{factVersion(f)}</span></div
                >
              {/each}
              {#if facts.length > 5}
                <div class="item more">… 共 {facts.length} 个 Fact</div>
              {/if}
            {:else}
              <div class="item empty">无 Fact 产生</div>
              <div class="item hint">sandbox Draft 规则缺陷待独立立项</div>
            {/if}
          </div>
        </div>

        <div class="chain-arrow">→</div>

        <!-- 节点 3: 最终状态 -->
        <div class="chain-node">
          <div class="node-title">🏁 最终状态</div>
          <div class="node-body">
            {#if lastFact}
              <div class="item"><span class="tag">末位Fact</span> <span class="val">{lastFact.type}</span></div>
              <div class="item"><span class="tag">Fact数</span> <span class="val">{facts.length}</span></div>
              <div class="item"><span class="tag">末哈希</span> <span class="val mono">{truncateHash(audit?.last_hash, 10)}</span></div>
            {:else}
              <div class="item empty">无最终状态</div>
            {/if}
          </div>
        </div>

        <div class="chain-arrow">→</div>

        <!-- 节点 4: 判定结果 (应用层判定) -->
        <div class="chain-node">
          <div class="node-title">🎯 判定结果</div>
          <div class="node-body">
            <div class="item">
              <VerdictBadge
                kind={verdictKind}
                value={verdict ? verdict.verdict.toUpperCase() : "未判定"}
              />
            </div>
            <div class="item hint">应用层判定 (判定契约)</div>
            <div class="item hint">❌ 非 evorule 确定性</div>
          </div>
        </div>
      </section>

      <!-- 详情区 -->
      <section class="detail-area">
        <div class="detail-card">
          <div class="detail-title">📋 Fact 流详情</div>
          {#if facts.length > 0}
            <ol class="fact-detail-list">
              {#each facts as f}
                <li>
                  <span class="fact-type">{f.type}</span>
                  <span class="fact-ver">{factVersion(f)}</span>
                  <span class="fact-id">#{f.id}</span>
                </li>
              {/each}
            </ol>
          {:else}
            <p class="detail-empty">无 Fact 流数据 (沙盒未产生 Fact)</p>
          {/if}
        </div>

        <div class="detail-card">
          <div class="detail-title">🎯 命中规则</div>
          <p class="detail-empty">— 待独立立项（rule_id 透传）</p>
          <p class="detail-hint">
            rule_id 在 server 加载合并时丢失, 命中规则追溯独立立项 (见 00_架构边界原则 §0.2)。
          </p>
        </div>

        <div class="detail-card">
          <div class="detail-title">🔗 链完整性</div>
          <div class="integrity-row">
            <VerdictBadge
              kind={chainVerified ? "chain-verified" : "chain-broken"}
              value={chainVerified ? "链完整性已验证" : "未验证 / 链断裂"}
            />
            <span class="detail-hint"
              >Fact 计数: {audit?.fact_count ?? facts.length}</span
            >
          </div>
        </div>
      </section>
    {/if}
  </div>

  <!-- === 底部操作栏 === -->
  {#if !loading && sandbox}
    <footer class="footer-actions">
      <button class="btn" onclick={backToEditor}>← 返回修改</button>
      <button class="btn btn-success" onclick={approveForPublish}>✅ 通过,可发布</button>
      <button class="btn btn-primary" onclick={retest}>🔄 重新测试</button>
    </footer>
  {/if}
</div>

<style>
  .sandbox-page {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 100vh;
    background: var(--bg-primary);
    overflow: hidden;
  }

  /* === 顶部导航 === */
  .topbar {
    height: 56px;
    min-height: 56px;
    display: flex;
    align-items: center;
    padding: 0 var(--spacing-lg);
    border-bottom: 1px solid var(--border);
    gap: var(--spacing-md);
    background: var(--bg-primary);
    flex-shrink: 0;
  }

  .back-link {
    color: var(--text-secondary);
    background: transparent;
    border: none;
    font-size: var(--text-sm);
    cursor: pointer;
    font-family: var(--font-sans);
  }

  .back-link:hover {
    color: var(--text-primary);
  }

  .title {
    font-size: var(--text-lg);
    font-weight: var(--font-semibold);
    color: var(--text-primary);
  }

  .sandbox-badge {
    font-size: var(--text-xs);
    color: var(--warning);
    background: color-mix(in srgb, var(--warning) 8%, transparent);
    border: 1px solid color-mix(in srgb, var(--warning) 25%, var(--border));
    padding: 2px var(--spacing-sm);
    border-radius: var(--radius-sm);
    font-family: var(--font-mono);
  }

  .spacer {
    flex: 1;
  }

  .meta-info {
    font-size: var(--text-xs);
    color: var(--text-secondary);
    font-family: var(--font-mono);
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-xs);
  }

  .non-det {
    color: var(--warning);
    font-size: 10px;
  }

  /* === 主体 === */
  .main {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: var(--spacing-md) var(--spacing-lg);
    overflow-y: auto;
    gap: var(--spacing-md);
  }

  .state-block {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-2xl);
    color: var(--text-secondary);
    text-align: center;
  }

  .state-block.error .state-icon {
    color: var(--danger);
  }

  .state-icon {
    font-size: 40px;
  }

  /* === 输入摘要 === */
  .input-summary {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: var(--spacing-sm) var(--spacing-md);
    display: flex;
    align-items: center;
    gap: var(--spacing-lg);
    flex-shrink: 0;
    flex-wrap: wrap;
  }

  .summary-label {
    font-size: var(--text-xs);
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.3px;
    font-weight: var(--font-medium);
  }

  .event-data {
    display: flex;
    gap: var(--spacing-md);
    font-size: var(--text-sm);
    font-family: var(--font-mono);
    flex-wrap: wrap;
  }

  .event-data .pair {
    display: inline-flex;
    gap: 6px;
  }

  .event-data .pair .key {
    color: var(--text-secondary);
  }

  .event-data .pair .value {
    color: var(--text-primary);
    font-weight: var(--font-medium);
  }

  .event-data .pair .value.running {
    color: var(--warning);
  }

  .mono {
    font-family: var(--font-mono);
  }

  /* === 因果链 === */
  .causal-chain {
    display: flex;
    align-items: stretch;
    gap: 0;
    min-height: 180px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    overflow: hidden;
    flex-shrink: 0;
  }

  .chain-node {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: var(--spacing-md);
    border-right: 1px solid var(--border);
    justify-content: flex-start;
    min-width: 0;
  }

  .chain-node:last-child {
    border-right: none;
  }

  .node-title {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-secondary);
    font-weight: var(--font-semibold);
    margin-bottom: var(--spacing-xs);
  }

  .node-body {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .item {
    font-size: var(--text-xs);
    font-family: var(--font-mono);
    color: var(--text-primary);
    padding: 3px 0;
    border-bottom: 1px solid color-mix(in srgb, var(--border) 50%, transparent);
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    flex-wrap: wrap;
  }

  .item:last-child {
    border-bottom: none;
  }

  .item .tag {
    font-size: 10px;
    color: var(--text-secondary);
    background: var(--bg-primary);
    padding: 0 6px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
  }

  .item .val {
    color: var(--brand);
  }

  .item.empty {
    color: var(--text-secondary);
    font-style: italic;
  }

  .item.hint {
    color: var(--text-secondary);
    font-size: 10px;
    border-bottom: none;
  }

  .item.more {
    color: var(--text-secondary);
    font-size: 10px;
    border-bottom: none;
  }

  .chain-arrow {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary);
    font-size: var(--text-lg);
    padding: 0 4px;
    min-width: 28px;
    flex-shrink: 0;
    background: var(--bg-card);
    border-right: 1px solid var(--border);
  }

  /* === 详情区 === */
  .detail-area {
    display: flex;
    gap: var(--spacing-md);
    flex-shrink: 0;
  }

  .detail-card {
    flex: 1;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: var(--spacing-sm) var(--spacing-md);
    min-width: 0;
  }

  .detail-title {
    font-size: 10px;
    text-transform: uppercase;
    color: var(--text-secondary);
    letter-spacing: 0.3px;
    font-weight: var(--font-semibold);
    margin-bottom: var(--spacing-xs);
  }

  .fact-detail-list {
    margin: 0;
    padding-left: var(--spacing-md);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--text-primary);
    max-height: 160px;
    overflow-y: auto;
  }

  .fact-detail-list li {
    padding: 2px 0;
    display: flex;
    gap: var(--spacing-sm);
  }

  .fact-detail-list .fact-type {
    color: var(--brand);
    font-weight: var(--font-medium);
  }

  .fact-detail-list .fact-ver {
    color: var(--text-secondary);
  }

  .fact-detail-list .fact-id {
    color: var(--text-secondary);
    margin-left: auto;
  }

  .detail-empty {
    font-size: var(--text-sm);
    color: var(--text-secondary);
    margin: 0;
    font-family: var(--font-mono);
  }

  .detail-hint {
    font-size: var(--text-xs);
    color: var(--text-secondary);
    margin: var(--spacing-xs) 0 0 0;
    line-height: 1.5;
  }

  .integrity-row {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    flex-wrap: wrap;
  }

  /* === 底部操作栏 === */
  .footer-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-lg);
    border-top: 1px solid var(--border);
    flex-shrink: 0;
  }

  .btn {
    font-family: var(--font-sans);
    padding: var(--spacing-xs) var(--spacing-lg);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    cursor: pointer;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--text-secondary);
    height: 36px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .btn-primary {
    background: var(--brand);
    color: var(--bg-card);
    border-color: var(--brand);
  }

  .btn-primary:hover {
    background: var(--brand-strong);
    border-color: var(--brand-strong);
    color: var(--bg-card);
  }

  .btn-success {
    background: var(--success);
    color: var(--bg-primary);
    border-color: var(--success);
  }

  .btn-success:hover {
    background: color-mix(in srgb, var(--success) 85%, var(--bg-primary));
    border-color: var(--success);
    color: var(--bg-primary);
  }

  .btn-secondary {
    padding: var(--spacing-xs) var(--spacing-md);
    background: transparent;
    color: var(--text-primary);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    cursor: pointer;
    font-size: var(--text-sm);
    font-family: var(--font-sans);
  }

  @media (max-width: 900px) {
    .causal-chain {
      flex-direction: column;
      min-height: auto;
    }
    .chain-node {
      border-right: none;
      border-bottom: 1px solid var(--border);
    }
    .chain-arrow {
      border-right: none;
      min-width: auto;
      padding: var(--spacing-xs) 0;
    }
    .detail-area {
      flex-direction: column;
    }
  }
</style>
