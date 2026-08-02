<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (C) 2026 EvoRule Project -->
<!-- evorule-console 主视图容器 — 根据 currentView 渲染 5 视图之一 -->
<!--
  依据: docs/IMPLEMENTATION_PLAN.md 阶段6
  设计:
    - 单页 + tab 切换:每次只渲染当前视图(destroy/recreate)
    - 跨视图状态(session/rules/audit)在 Svelte stores 中,组件销毁不丢失
    - 懒加载:未切到的视图不 mount(避免 5 视图同时初始化 + 抢 backend)
-->

<script lang="ts">
  import { currentView } from "$lib/stores/view";
  import RuleLibrary from "$lib/views/RuleLibrary/RuleLibrary.svelte";
  import ExecutionPad from "$lib/views/ExecutionPad/ExecutionPad.svelte";
  import StateView from "$lib/views/StateView/StateView.svelte";
  import AuditView from "$lib/views/AuditView/AuditView.svelte";
  import TimeTravel from "$lib/views/TimeTravel/TimeTravel.svelte";
</script>

{#if $currentView === "rules"}
  <RuleLibrary />
{:else if $currentView === "execution"}
  <ExecutionPad />
{:else if $currentView === "state"}
  <StateView />
{:else if $currentView === "audit"}
  <AuditView />
{:else if $currentView === "timetravel"}
  <TimeTravel />
{/if}
