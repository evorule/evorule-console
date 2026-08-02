<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (C) 2026 EvoRule Project -->
<!-- evorule-console 根布局 — 顶部导航 + backend 注入 + 主题 + 连接状态 -->
<!--
  依据: docs/IMPLEMENTATION_PLAN.md 阶段6
  职责:
    - 注入 ExecutionBackend(HttpBackend → 127.0.0.1:18080),所有子视图经 context 取用
    - 顶部导航:品牌 + 5 视图 tab(每个标注对应的 evorule 本质)+ 主题切换 + 连接徽标
    - 主题/视图状态持久化(localStorage)
  设计:
    - 单页 + tab 切换(非多路由),因 5 视图共享 session store 状态
    - 连接徽标调 backend.health() 反映 evorule-server 是否在线
-->

<script lang="ts">
  import "../app.css";
  import { onMount } from "svelte";
  import { theme, toggleTheme } from "$lib/stores/theme";
  import {
    currentView,
    setView,
    restoreView,
    VIEW_LIST,
  } from "$lib/stores/view";
  import { provideBackend } from "$lib/backend/backend-context";

  let { children } = $props();

  // 注入 backend — 必须在组件初始化时调用(setContext 要求),不能放 onMount
  // HttpBackend 默认指向 127.0.0.1:18080(evorule-server)
  const backend = provideBackend();

  // 连接状态:null=检测中, true=已连接, false=未连接
  let connected = $state<boolean | null>(null);

  onMount(() => {
    // === 主题恢复(保留原逻辑)==
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme) {
      theme.set(savedTheme as "light" | "dark");
    } else {
      const prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)",
      ).matches;
      theme.set(prefersDark ? "dark" : "light");
    }
    const unsubTheme = theme.subscribe((value) => {
      document.documentElement.setAttribute("data-theme", value);
      localStorage.setItem("theme", value);
    });

    // === 视图恢复 ===
    restoreView();

    // === backend 健康检查(反映 evorule-server 是否在线)==
    backend
      .health()
      .then((ok) => {
        connected = ok;
      })
      .catch(() => {
        connected = false;
      });

    return () => unsubTheme();
  });
</script>

<div class="app">
  <header class="topbar">
    <div class="brand">
      <span class="brand-name">evorule-console</span>
      <span class="brand-tag">evorule 规则引擎面板 · 无智能,只有执行</span>
    </div>

    <nav class="nav-tabs" aria-label="视图切换">
      {#each VIEW_LIST as view (view.id)}
        <button
          class="nav-tab"
          class:active={$currentView === view.id}
          onclick={() => setView(view.id)}
          title={view.essence}
          aria-pressed={$currentView === view.id}
        >
          <span class="tab-icon">{view.icon}</span>
          <span class="tab-label">{view.label}</span>
        </button>
      {/each}
    </nav>

    <div class="topbar-actions">
      <span
        class="conn-badge"
        class:online={connected === true}
        class:offline={connected === false}
        class:checking={connected === null}
        title={connected === false
          ? "需要 evorule-server 跑在 127.0.0.1:18080"
          : "evorule-server 连接状态"}
      >
        <span class="conn-dot"></span>
        <span class="conn-text">
          {connected === null ? "检测中" : connected ? "已连接" : "未连接"}
        </span>
      </span>

      <button
        class="theme-toggle"
        onclick={toggleTheme}
        title="切换主题"
        aria-label="切换主题"
      >
        {$theme === "light" ? "🌙" : "☀️"}
      </button>
    </div>
  </header>

  <main class="main-content">
    {@render children()}
  </main>
</div>

<style>
  .app {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--color-gray-50);
  }

  /* === 顶部导航栏 === */
  .topbar {
    display: flex;
    align-items: center;
    gap: var(--spacing-lg);
    padding: 0 var(--spacing-xl);
    background: var(--color-gray-900);
    color: #fff;
    box-shadow: var(--shadow-md);
    position: sticky;
    top: 0;
    z-index: 10;
    flex-wrap: wrap;
  }

  .brand {
    display: flex;
    flex-direction: column;
    padding: var(--spacing-sm) 0;
    flex-shrink: 0;
  }
  .brand-name {
    font-size: var(--text-lg);
    font-weight: 600;
    letter-spacing: 0.02em;
  }
  .brand-tag {
    font-size: var(--text-xs);
    color: var(--color-gray-400);
    margin-top: 2px;
  }

  /* === 导航 tabs === */
  .nav-tabs {
    display: flex;
    gap: var(--spacing-xs);
    flex: 1;
    justify-content: center;
  }
  .nav-tab {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-xs);
    padding: var(--spacing-sm) var(--spacing-md);
    background: transparent;
    color: var(--color-gray-300);
    border: none;
    border-bottom: 2px solid transparent;
    border-radius: 0;
    cursor: pointer;
    font-size: var(--text-sm);
    transition:
      color var(--transition-fast),
      border-color var(--transition-fast);
  }
  .nav-tab:hover {
    color: #fff;
    background: rgba(255, 255, 255, 0.06);
  }
  .nav-tab.active {
    color: #fff;
    border-bottom-color: var(--color-primary);
    background: rgba(255, 255, 255, 0.04);
  }
  .tab-icon {
    font-size: var(--text-base);
  }
  .tab-label {
    font-weight: 500;
  }

  /* === 右侧操作区 === */
  .topbar-actions {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    flex-shrink: 0;
  }
  .conn-badge {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-xs);
    font-size: var(--text-xs);
    color: var(--color-gray-400);
  }
  .conn-dot {
    width: 8px;
    height: 8px;
    border-radius: var(--radius-full);
    background: var(--color-gray-500);
  }
  .conn-badge.online .conn-dot {
    background: var(--color-success);
  }
  .conn-badge.online .conn-text {
    color: var(--color-success);
  }
  .conn-badge.offline .conn-dot {
    background: var(--color-error);
  }
  .conn-badge.offline .conn-text {
    color: var(--color-error);
  }
  .conn-badge.checking .conn-dot {
    background: var(--color-warning);
    animation: pulse 1.2s ease-in-out infinite;
  }
  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.4;
    }
  }

  .theme-toggle {
    background: transparent;
    color: var(--color-gray-300);
    border: 1px solid var(--color-gray-700);
    border-radius: var(--radius-md);
    padding: var(--spacing-xs) var(--spacing-sm);
    cursor: pointer;
    font-size: var(--text-base);
    line-height: 1;
  }
  .theme-toggle:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
  }

  /* === 主内容区 === */
  .main-content {
    flex: 1;
    width: 100%;
    overflow: auto;
  }

  @media (max-width: 768px) {
    .topbar {
      padding: 0 var(--spacing-md);
    }
    .brand-tag {
      display: none;
    }
    .nav-tabs {
      gap: 0;
      justify-content: flex-start;
      overflow-x: auto;
    }
    .nav-tab {
      padding: var(--spacing-sm);
    }
    .tab-label {
      display: none;
    }
    .nav-tab.active .tab-label {
      display: inline;
    }
  }
</style>
