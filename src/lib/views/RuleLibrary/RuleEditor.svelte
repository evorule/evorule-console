<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (C) 2026 EvoRule Project -->
<!-- evorule-console 规则编辑器 — 实时 G1-G7 预校验 -->
<!--
  依据: docs/IMPLEMENTATION_PLAN.md 阶段2 + GATE_ALIGNMENT.md
  职责:
    - JSON 编辑(textarea,带等宽字体 + 行号)
    - 实时跑 RuleValidator.validate(content),展示 G1-G7 通过/失败
    - 保存时调 onsave 回调
  门禁分层:
    - L_console 本文件:UX 预校验
    - L0 核心仓 build.rs:最终权威(提交后拦截)
-->

<script lang="ts">
  import { untrack } from "svelte";
  import {
    RuleValidator,
    type ValidationResult,
  } from "$lib/validators/ruleValidator";

  interface Props {
    mode: "create" | "edit";
    ruleId: string | null;
    initialContent: string;
    onsave: (content: string, description: string, version: number) => void;
    oncancel: () => void;
  }

  let { mode, ruleId, initialContent, onsave, oncancel }: Props = $props();

  // 初始化:一次性解析 initialContent,提取 description / version
  // untrack 显式声明:这里只读 initialContent 的初始值,不建立响应式依赖
  // (否则 initialContent 变化会覆盖用户编辑)
  let initParsed: { description?: string; version?: number } = untrack(() => {
    try {
      return JSON.parse(initialContent);
    } catch {
      // 解析失败由下面的实时 validation 捕获并显示
      return {};
    }
  });

  let content = $state(untrack(() => initialContent));
  let description = $state(initParsed.description ?? "");
  let version = $state(initParsed.version ?? 1);
  let parseError = $state<string | null>(null);

  // 实时校验:用户每次输入触发
  let validation = $state<ValidationResult>({ valid: false, errors: [] });
  $effect(() => {
    validation = RuleValidator.validate(content);
  });

  // 7 个 G 的当前状态(用于在 UI 展示)
  let gateStatus = $derived(
    (["G1", "G2", "G3", "G4", "G5", "G6", "G7"] as const).map((g) => {
      const err = validation.errors.find((e) => e.gate === g);
      return {
        gate: g,
        passed: !err,
        message: err?.message ?? null,
        path: err?.path ?? null,
      };
    }),
  );

  const GATE_DESCRIPTIONS: Record<string, { name: string; align: string }> = {
    G1: { name: "JSON 格式", align: "前置条件" },
    G2: {
      name: "元指令类型(set/push/branch/io_request)",
      align: "TCB_SPEC.md T1",
    },
    G3: { name: "I/O 双路径模式", align: "TCB_SPEC.md D7" },
    G4: {
      name: "域类型(eq/lt/exists/instruction/all/not)",
      align: "TCB_SPEC.md T2",
    },
    G5: { name: "路径引用(__exec__.payload.*)", align: "TCB_SPEC.md D9" },
    G6: { name: "兜底规则(末条 branch+all([]))", align: "TCB_SPEC.md D2" },
    G7: { name: "递归深度 ≤64", align: "TCB_SPEC.md D2" },
  };

  let canSave = $derived(validation.valid && !parseError);

  function handleSave() {
    if (!canSave) return;
    // 保存前自动格式化(若可解析)
    try {
      const parsed = JSON.parse(content);
      content = JSON.stringify(parsed, null, 2);
    } catch {
      // 不应到达(canSave 已校验),但容错
    }
    onsave(content, description, version);
  }

  function handleFormat() {
    try {
      const parsed = JSON.parse(content);
      content = JSON.stringify(parsed, null, 2);
    } catch (e) {
      parseError = (e as Error).message;
    }
  }

  // ESC 关闭
  function handleKeydown(event: KeyboardEvent) {
    if (
      event.key === "Escape" &&
      (event.target as HTMLElement)?.tagName !== "TEXTAREA"
    ) {
      oncancel();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div
  class="editor-overlay"
  role="dialog"
  aria-modal="true"
  aria-label="规则编辑器"
>
  <div class="editor-modal">
    <header class="editor-header">
      <h2>{mode === "create" ? "新建规则" : `编辑规则: ${ruleId ?? ""}`}</h2>
      <button class="close-btn" onclick={oncancel} aria-label="关闭">✕</button>
    </header>

    <div class="editor-body">
      <div class="editor-main">
        <div class="meta-form">
          <label class="field">
            <span class="field-label">描述</span>
            <input
              type="text"
              bind:value={description}
              placeholder="业务专家可读的规则描述"
            />
          </label>
          <label class="field field-version">
            <span class="field-label">版本</span>
            <input type="number" min="1" bind:value={version} />
          </label>
        </div>

        <div class="content-toolbar">
          <span class="toolbar-label">规则内容 (JSON)</span>
          <button class="btn-mini" onclick={handleFormat}>格式化</button>
        </div>

        <textarea
          class="json-editor"
          bind:value={content}
          spellcheck="false"
          autocomplete="off"
          placeholder="在此输入 evorule 规则 JSON..."
        ></textarea>

        {#if parseError}
          <div class="parse-error">
            <span>JSON 解析错误:</span>
            <code>{parseError}</code>
          </div>
        {/if}
      </div>

      <aside class="validation-panel">
        <header class="panel-header">
          <h3>L_console 预校验</h3>
          <span
            class="panel-result"
            class:passed={validation.valid}
            class:failed={!validation.valid}
          >
            {validation.valid ? "✅ 全部通过" : "❌ 有失败项"}
          </span>
        </header>

        <div class="gate-list">
          {#each gateStatus as g (g.gate)}
            <div
              class="gate-item"
              class:passed={g.passed}
              class:failed={!g.passed}
            >
              <div class="gate-row">
                <span class="gate-icon">{g.passed ? "✅" : "❌"}</span>
                <span class="gate-label">{g.gate}</span>
                <span class="gate-name">{GATE_DESCRIPTIONS[g.gate].name}</span>
              </div>
              <div class="gate-align">
                对齐: {GATE_DESCRIPTIONS[g.gate].align}
              </div>
              {#if !g.passed && g.message}
                <div class="gate-message">{g.message}</div>
                {#if g.path}
                  <div class="gate-path">位置: {g.path}</div>
                {/if}
              {/if}
            </div>
          {/each}
        </div>

        <div class="panel-footer">
          <p class="panel-hint">
            ⚠ L_console 是 UX 预校验,提交后核心仓 build.rs(L0)做最终拦截。
          </p>
        </div>
      </aside>
    </div>

    <footer class="editor-footer">
      <span class="status">
        {#if canSave}
          ✅ 校验通过,可保存
        {:else}
          ⚠ 校验未通过,无法保存
        {/if}
      </span>
      <div class="footer-actions">
        <button class="btn" onclick={oncancel}>取消</button>
        <button
          class="btn btn-primary"
          onclick={handleSave}
          disabled={!canSave}
        >
          保存
        </button>
      </div>
    </footer>
  </div>
</div>

<style>
  .editor-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .editor-modal {
    width: 90vw;
    height: 90vh;
    max-width: 1400px;
    background: white;
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-xl);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .editor-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-md) var(--spacing-lg);
    border-bottom: 1px solid var(--color-gray-200);
    background: var(--color-gray-50);
  }

  .editor-header h2 {
    margin: 0;
    font-size: var(--text-lg);
    color: var(--color-gray-900);
  }

  .close-btn {
    background: transparent;
    border: none;
    font-size: var(--text-xl);
    color: var(--color-gray-500);
    cursor: pointer;
    padding: var(--spacing-xs);
    border-radius: var(--radius-sm);
  }

  .close-btn:hover {
    background: var(--color-gray-100);
  }

  .editor-body {
    flex: 1;
    display: grid;
    grid-template-columns: 1fr 360px;
    overflow: hidden;
    min-height: 0;
  }

  .editor-main {
    display: flex;
    flex-direction: column;
    padding: var(--spacing-md);
    gap: var(--spacing-sm);
    overflow: hidden;
    min-width: 0;
  }

  .meta-form {
    display: grid;
    grid-template-columns: 1fr 100px;
    gap: var(--spacing-sm);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .field-label {
    font-size: var(--text-xs);
    color: var(--color-gray-600);
    font-weight: 600;
  }

  .field input {
    padding: var(--spacing-sm) var(--spacing-md);
    border: 1px solid var(--color-gray-300);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
  }

  .field input:focus {
    outline: none;
    border-color: var(--color-primary);
  }

  .content-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: var(--spacing-sm);
  }

  .toolbar-label {
    font-size: var(--text-xs);
    color: var(--color-gray-600);
    font-weight: 600;
    text-transform: uppercase;
  }

  .btn-mini {
    background: transparent;
    border: 1px solid var(--color-gray-300);
    padding: 2px 8px;
    font-size: var(--text-xs);
    border-radius: var(--radius-sm);
    cursor: pointer;
    color: var(--color-gray-700);
  }

  .btn-mini:hover {
    background: var(--color-gray-100);
  }

  .json-editor {
    flex: 1;
    width: 100%;
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    line-height: 1.6;
    padding: var(--spacing-md);
    border: 1px solid var(--color-gray-300);
    border-radius: var(--radius-md);
    resize: none;
    white-space: pre;
    overflow: auto;
    tab-size: 2;
  }

  .json-editor:focus {
    outline: none;
    border-color: var(--color-primary);
  }

  .parse-error {
    padding: var(--spacing-sm) var(--spacing-md);
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: var(--radius-md);
    color: var(--color-error);
    font-size: var(--text-sm);
  }

  .parse-error code {
    display: block;
    margin-top: var(--spacing-xs);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
  }

  .validation-panel {
    border-left: 1px solid var(--color-gray-200);
    overflow-y: auto;
    background: var(--color-gray-50);
    display: flex;
    flex-direction: column;
  }

  .panel-header {
    padding: var(--spacing-md);
    border-bottom: 1px solid var(--color-gray-200);
    background: white;
    display: flex;
    justify-content: space-between;
    align-items: center;
    position: sticky;
    top: 0;
    z-index: 1;
  }

  .panel-header h3 {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--color-gray-900);
  }

  .panel-result {
    font-size: var(--text-xs);
    font-weight: 600;
    padding: 2px 8px;
    border-radius: var(--radius-sm);
  }

  .panel-result.passed {
    background: #d1fae5;
    color: #065f46;
  }

  .panel-result.failed {
    background: #fee2e2;
    color: #991b1b;
  }

  .gate-list {
    padding: var(--spacing-sm);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .gate-item {
    padding: var(--spacing-sm);
    background: white;
    border-radius: var(--radius-md);
    border-left: 3px solid;
    font-size: var(--text-xs);
  }

  .gate-item.passed {
    border-left-color: var(--color-success);
  }

  .gate-item.failed {
    border-left-color: var(--color-error);
  }

  .gate-row {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
  }

  .gate-icon {
    font-size: var(--text-sm);
  }

  .gate-label {
    font-family: var(--font-mono);
    font-weight: 600;
    color: var(--color-gray-900);
  }

  .gate-name {
    color: var(--color-gray-700);
    flex: 1;
  }

  .gate-align {
    font-size: 10px;
    color: var(--color-gray-500);
    margin-top: 2px;
    margin-left: calc(var(--text-sm) + var(--spacing-xs));
  }

  .gate-message {
    margin-top: var(--spacing-xs);
    padding: var(--spacing-xs) var(--spacing-sm);
    background: #fef2f2;
    border-radius: var(--radius-sm);
    color: var(--color-error);
    font-family: var(--font-mono);
    font-size: 11px;
  }

  .gate-path {
    margin-top: 2px;
    color: var(--color-gray-500);
    font-family: var(--font-mono);
    font-size: 10px;
  }

  .panel-footer {
    margin-top: auto;
    padding: var(--spacing-sm) var(--spacing-md);
    border-top: 1px solid var(--color-gray-200);
    background: #fffbeb;
  }

  .panel-hint {
    margin: 0;
    font-size: 11px;
    color: #92400e;
    line-height: 1.4;
  }

  .editor-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-md) var(--spacing-lg);
    border-top: 1px solid var(--color-gray-200);
    background: var(--color-gray-50);
  }

  .status {
    font-size: var(--text-sm);
    color: var(--color-gray-700);
  }

  .footer-actions {
    display: flex;
    gap: var(--spacing-sm);
  }

  .btn {
    padding: var(--spacing-sm) var(--spacing-md);
    border: 1px solid var(--color-gray-300);
    background: white;
    color: var(--color-gray-700);
    border-radius: var(--radius-md);
    cursor: pointer;
    font-size: var(--text-sm);
  }

  .btn:hover {
    background: var(--color-gray-100);
  }

  .btn-primary {
    background: var(--color-primary);
    border-color: var(--color-primary);
    color: white;
  }

  .btn-primary:hover {
    background: var(--color-primary-hover);
  }

  .btn-primary:disabled {
    background: var(--color-gray-300);
    border-color: var(--color-gray-300);
    cursor: not-allowed;
  }

  @media (max-width: 1024px) {
    .editor-body {
      grid-template-columns: 1fr;
      grid-template-rows: 1fr auto;
    }
    .validation-panel {
      max-height: 300px;
      border-left: none;
      border-top: 1px solid var(--color-gray-200);
    }
  }
</style>
