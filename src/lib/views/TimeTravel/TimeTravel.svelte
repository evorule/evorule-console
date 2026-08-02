<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (C) 2026 EvoRule Project -->
<!-- evorule-console 时间旅行视图 — 嵌入 ttd,展现 evorule "可回放" -->
<!--
  依据: docs/SPEC.md §4
  依据: docs/IMPLEMENTATION_PLAN.md 阶段5
  依据: ./../../ttd/VERSION.md(适配说明)

  职责:
    - 容器:Svelte 组件包装 ttd vanilla JS 5 视图
    - 适配:console HttpBackend → ttd api 对象(console-adapter.ts injectBackend)
    - 同步:console session store 的 currentSessionId → ttd store
    - 样式:console-scoped.css 限定 .ttd-root,避免污染 console light 主题

  设计:
    - Svelte 渲染 HTML 结构(sidebar + tabs + 5 panels)
    - onMount 时 ttd 在该容器内做 vanilla DOM 操作
    - ttd 的 views 通过 eventbus 通信,组件不干预内部交互
-->

<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { currentSessionId } from "$lib/stores/session";
  import { useBackendOrNull } from "$lib/backend/backend-context";
  import { initTtd, cleanupTtd } from "$lib/ttd/main.js";
  import { injectBackend, syncSessionToTtd } from "$lib/ttd/console-adapter";
  import "$lib/ttd/styles/console-scoped.css";

  const backend = useBackendOrNull();

  // Svelte 5: bind:this 变量需用 $state 声明,否则 svelte-check 警告 non_reactive_update
  let ttdRoot: HTMLDivElement | undefined = $state();
  let unsubSession: (() => void) | null = null;
  let initialized = $state(false);
  let initError = $state<string | null>(null);

  onMount(async () => {
    if (!backend) {
      initError =
        "backend 未注入(开发期需要 evorule-server 跑在 127.0.0.1:18080)";
      return;
    }
    if (!ttdRoot) return;

    try {
      // 1. 注入 console backend 到 ttd api 模块
      injectBackend(backend);

      // 2. 初始化 ttd:
      //    - skipAutoSelect: evorule-console 自己管理 session(走 ExecutionPad),
      //                      不让 ttd 自动选第一个
      //    - skipApiUrl: console 通过 console-adapter 注入 backend,
      //                  ttd 不需要 apiUrl 输入框(也不渲染 header)
      await initTtd({ skipAutoSelect: true, skipApiUrl: true });
      initialized = true;

      // 3. 若 console 当前已有 session,同步给 ttd
      if ($currentSessionId !== null) {
        await syncSessionToTtd($currentSessionId);
      }

      // 4. 监听 console session 变化,自动同步给 ttd
      unsubSession = currentSessionId.subscribe(async (id) => {
        await syncSessionToTtd(id);
      });
    } catch (e) {
      initError = `ttd 初始化失败: ${(e as Error).message}`;
    }
  });

  onDestroy(() => {
    if (unsubSession) unsubSession();
    cleanupTtd();
  });
</script>

<div class="time-travel-view">
  <header class="view-header">
    <div class="title-group">
      <h1>时间旅行</h1>
      <span class="subtitle"
        >可回放 — rewind / diff / causal / what-if(嵌入 ttd v1.0)</span
      >
    </div>
  </header>

  {#if !backend}
    <div class="empty-state">
      <span class="empty-icon">🔌</span>
      <p>backend 未注入</p>
      <p class="empty-hint">开发期需要 evorule-server 跑在 127.0.0.1:18080</p>
    </div>
  {:else if initError}
    <div class="error-banner" role="alert">
      <span>⚠</span>
      <span>{initError}</span>
    </div>
  {:else if $currentSessionId === null}
    <div class="empty-state">
      <span class="empty-icon">📭</span>
      <p>无当前 session</p>
      <p class="empty-hint">先到执行台创建 session,时间旅行视图会自动同步</p>
    </div>
  {:else}
    <!-- ttd 容器:console-scoped.css 限定 .ttd-root 内的样式作用域 -->
    <div class="ttd-root" bind:this={ttdRoot}>
      <div class="main">
        <aside class="sidebar">
          <h2>会话 (Sessions)</h2>
          <ul class="session-list" id="sessionList">
            <li class="session-item">加载中...</li>
          </ul>
        </aside>
        <div class="content">
          <div class="tabs">
            <div class="tab active" data-tab="timeline" role="tab">
              ⏱ 时间线
            </div>
            <div class="tab" data-tab="state" role="tab">📦 状态</div>
            <div class="tab" data-tab="causal" role="tab">🔗 因果链</div>
            <div class="tab" data-tab="diff" role="tab">⇄ 对比</div>
            <div class="tab" data-tab="whatif" role="tab">🔀 假设</div>
          </div>

          <div class="panel active" id="panel-timeline" role="tabpanel">
            <div class="empty">从左侧选择一个 session</div>
          </div>
          <div class="panel" id="panel-state" role="tabpanel">
            <div class="empty">从左侧选择一个 session</div>
          </div>
          <div class="panel" id="panel-causal" role="tabpanel">
            <div class="empty">在「时间线」中点击一个 fact 查看因果链</div>
          </div>
          <div class="panel" id="panel-diff" role="tabpanel">
            <div class="empty">从左侧选择一个 session</div>
          </div>
          <div class="panel" id="panel-whatif" role="tabpanel">
            <div class="empty">
              🔀 What-If 分析 — 从左侧选择一个 session 开始
            </div>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .time-travel-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .view-header {
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

  /* ttd-root 容器占满剩余空间(高度 calc 减去 header) */
  .ttd-root {
    flex: 1;
    min-height: 0;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    min-height: 300px;
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

  .error-banner {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: var(--radius-md);
    color: var(--color-error);
    margin: var(--spacing-lg);
  }
</style>
