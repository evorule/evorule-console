<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (C) 2026 EvoRule Project -->
<!-- evorule-console 主视图容器 — 根据 currentView 渲染 4 视图之一 -->
<!--
  依据: docs/IMPLEMENTATION_PLAN.md 阶段6 + 实施文档_界面升级_v1.0.md §C.3.2
  设计:
    - 单页 + tab 切换:每次只渲染当前视图(destroy/recreate)
    - 跨视图状态(session/rules/audit)在 Svelte stores 中,组件销毁不丢失
    - 懒加载:未切到的视图不 mount(避免 5 视图同时初始化 + 抢 backend)
  阶段 C.3.2 改造:
    - rules tab 不再渲染 RuleLibrary 组件,改为 $effect 拦截 → goto /workspace
    - 原因:规则库已升级为独立工作空间路由(/workspace)
    - 保留 4 视图(execution/state/audit/timetravel)在本单页内渲染
-->

<script lang="ts">
  import { goto } from "$app/navigation";
  import { currentView, restored } from "$lib/stores/view";
  import ExecutionPad from "$lib/views/ExecutionPad/ExecutionPad.svelte";
  import StateView from "$lib/views/StateView/StateView.svelte";
  import AuditView from "$lib/views/AuditView/AuditView.svelte";
  import TimeTravel from "$lib/views/TimeTravel/TimeTravel.svelte";

  // rules tab 拦截:重定向到 /workspace 路由
  // ($effect 仅在浏览器端运行,SSR 时不触发,避免导航副作用)
  //
  // 竞态修复(阶段 D 联调发现):Svelte 5 中子组件 $effect 先于父组件
  // +layout.svelte 的 onMount 执行。若直接读 $currentView,会拿到默认值 'rules'
  // (restoreView 尚未运行)→ 总是重定向到 /workspace,state/audit/timetravel/
  // execution 4 视图在全量加载到 / 时不可达。
  //
  // 修复:等待 $restored=true(restoreView 末尾置位)后再判断。restored=false
  // 期间 $effect 不重定向,页面保持空白直到恢复完成(仅毫秒级,无感知闪烁)。
  $effect(() => {
    if ($restored && $currentView === "rules") {
      goto("/workspace", { replaceState: true });
    }
  });
</script>

{#if $currentView === "execution"}
  <ExecutionPad />
{:else if $currentView === "state"}
  <StateView />
{:else if $currentView === "audit"}
  <AuditView />
{:else if $currentView === "timetravel"}
  <TimeTravel />
{/if}
