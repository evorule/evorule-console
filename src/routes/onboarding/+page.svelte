<!--
  SPDX-License-Identifier: AGPL-3.0-or-later
  Copyright (C) 2026 EvoRule Project
  evorule-console 建库向导路由 (阶段 D.2.1)
-->
<!--
  依据: 设计文档/01_界面升级.txt §2.6 (建库向导 5 步)
        设计文档/05_建库向导.txt (详细线框 + 交互)
        实施文档_界面升级_v1.0.md §D.2.1
  职责:
    - 5 步流程: 选模板 → 命名 → 加规则 → 试运行 → 完成
    - 顶部 64px 导航 (Logo + 5 步进度条 + ✕ 退出)
    - 步骤 3: 简化业务表单 + 客户端实时翻译预览
    - 步骤 4: 客户端试运行预览 (条件求值, 标注"预览")
    - 步骤 5: 实际创建 workspace + 首条规则 (translateToTransform → createWorkspace → addRule)
  边界:
    - 试运行为客户端预览 (真实沙盒试运行在 /workspace/sandbox/[id], sandbox Draft 缺陷独立立项)
    - 规则内容经 translateToTransform 生成 (复用 server G1-G7 校验)
-->

<script lang="ts">
  import { goto } from "$app/navigation";
  import { useWorkspaceBackendOrNull } from "$lib/backend/workspace-context";
  import { addRule } from "$lib/stores/rules";
  import { selectWorkspace } from "$lib/stores/workspace";
  import {
    BUILTIN_FIELDS,
    BUSINESS_OPS,
    BUSINESS_ACTIONS,
    findField,
    opSymbol,
    actionLabel,
    businessRuleToTranslateInput,
    summarize,
    type BusinessFieldId,
    type BusinessOp,
    type BusinessAction,
  } from "$lib/views/business-rule-model";

  const backend = useWorkspaceBackendOrNull();

  // === 类型 (复用共享模型, 见 business-rule-model.ts) ===
  type TemplateId = "blank" | "finance" | "compliance";
  // FieldType/OpType/ActionType → BusinessFieldId/BusinessOp/BusinessAction (共享模型)
  // FIELDS/OPS/ACTIONS → BUILTIN_FIELDS/BUSINESS_OPS/BUSINESS_ACTIONS (共享模型)

  // === 模板预设 ===
  const TEMPLATES: Record<
    TemplateId,
    {
      icon: string;
      name: string;
      desc: string;
      hint: string;
      wsName: string;
      objects: string[];
      rule: {
        field: BusinessFieldId;
        op: BusinessOp;
        value: string;
        action: BusinessAction;
        role: string;
      };
    }
  > = {
    blank: {
      icon: "📋",
      name: "空白库",
      desc: "从零开始,完全自定义",
      hint: "适合有明确规则想法的专家",
      wsName: "",
      objects: [],
      rule: { field: "amount", op: "gte", value: "10000", action: "notify", role: "CFO" },
    },
    finance: {
      icon: "💰",
      name: "财务审批",
      desc: "报销上限规则 + CFO 审批流",
      hint: "含 1 条示例规则 · 5 分钟跑通",
      wsName: "财务审批库",
      objects: ["报销单", "预算", "审批流"],
      rule: { field: "amount", op: "gte", value: "10000", action: "notify", role: "CFO" },
    },
    compliance: {
      icon: "⚖️",
      name: "合规审计",
      desc: "风险等级检查 + 合规官审批",
      hint: "含 1 条示例规则 · 5 分钟跑通",
      wsName: "合规审计库",
      objects: ["案件", "控制点", "风险"],
      rule: { field: "risk", op: "eq", value: "high", action: "approve", role: "合规官" },
    },
  };

  /** 业务对象预设标签 (step 2 可选) */
  const PRESET_OBJECTS = [
    "报销单",
    "预算",
    "审批流",
    "案件",
    "控制点",
    "风险",
    "订单",
    "客户",
    "合同",
  ];

  const STEP_LABELS = ["选模板", "命名", "加规则", "试运行", "完成"];

  // === 向导状态 ===
  let step = $state(1);
  const totalSteps = 5;
  let selectedTemplate = $state<TemplateId | null>(null);

  // step 2
  let wsName = $state("");
  let selectedObjects = $state<string[]>([]);
  let customObjects = $state<string[]>([]);
  let customInput = $state("");

  // step 3
  let ruleField = $state<BusinessFieldId>("amount");
  let ruleOp = $state<BusinessOp>("gte");
  let ruleValue = $state("10000");
  let ruleAction = $state<BusinessAction>("notify");
  let ruleRole = $state("CFO");

  // step 4
  let trialApplicant = $state("张三");
  let trialValue = $state("12000");
  let trialResult = $state<"idle" | "triggered" | "auto-pass">("idle");

  // step 5
  let creating = $state(false);
  let errorMsg = $state<string | null>(null);
  let createdWsId = $state<string | null>(null);
  let createdRuleId = $state<string | null>(null);

  // === 派生 ===
  /** 步骤 3 实时翻译预览 (客户端, 对齐 05 文档) */
  let translationPreview = $derived(
    "📖 " +
      summarize({
        conditions: [{ field: ruleField, op: ruleOp, value: ruleValue || "0" }],
        actions: [{ type: ruleAction, role: ruleRole || "未知角色" }],
      })
  );

  /** 当前步骤是否可前进 */
  let canAdvance = $derived.by(() => {
    if (step === 1) return selectedTemplate !== null;
    if (step === 2) return wsName.trim().length > 0;
    if (step === 3)
      return ruleValue.trim().length > 0 && ruleRole.trim().length > 0;
    if (step === 4) return trialResult !== "idle";
    return true;
  });

  /** 所有业务对象 (预设选中 + 自定义) */
  let allObjects = $derived([...selectedObjects, ...customObjects]);

  // === 步骤导航 ===
  function nextStep() {
    if (step < totalSteps) {
      if (step === 4 && trialResult === "idle") {
        runTrial();
        return;
      }
      step++;
      if (step === 5) {
        completeWizard();
      }
    }
  }

  function prevStep() {
    if (step > 1) step--;
  }

  function exitWizard() {
    goto("/workspace");
  }

  // === step 1: 选模板 ===
  function selectTemplate(id: TemplateId) {
    selectedTemplate = id;
    const tpl = TEMPLATES[id];
    // 预填 step 2
    wsName = tpl.wsName;
    selectedObjects = [...tpl.objects];
    customObjects = [];
    // 预填 step 3
    ruleField = tpl.rule.field;
    ruleOp = tpl.rule.op;
    ruleValue = tpl.rule.value;
    ruleAction = tpl.rule.action;
    ruleRole = tpl.rule.role;
    // 预填 step 4
    trialValue = tpl.rule.value === "10000" ? "12000" : tpl.rule.value;
    trialResult = "idle";
  }

  // === step 2: 业务对象标签 ===
  function toggleObject(obj: string) {
    if (selectedObjects.includes(obj)) {
      selectedObjects = selectedObjects.filter((o) => o !== obj);
    } else {
      selectedObjects = [...selectedObjects, obj];
    }
  }

  function addCustomObject() {
    const name = customInput.trim();
    if (name && !allObjects.includes(name)) {
      customObjects = [...customObjects, name];
    }
    customInput = "";
  }

  // === step 4: 试运行 (客户端条件求值预览) ===
  function runTrial() {
    const target = parseValue(trialValue);
    const threshold = parseValue(ruleValue);
    let matched = false;
    switch (ruleOp) {
      case "gte":
        matched = target >= threshold;
        break;
      case "gt":
        matched = target > threshold;
        break;
      case "eq":
        matched = target === threshold;
        break;
      case "lt":
        matched = target < threshold;
        break;
    }
    trialResult = matched ? "triggered" : "auto-pass";
  }

  /** 数值/字符串解析 (number 字段转 number, risk 字段保持 string 比较) */
  function parseValue(v: string): number | string {
    if ((findField(ruleField)?.inputType ?? "text") === "number") {
      const n = Number(v);
      return Number.isNaN(n) ? 0 : n;
    }
    return v;
  }

  // === step 5: 实际创建 workspace + 规则 ===
  async function completeWizard() {
    if (!backend) {
      errorMsg = "backend 未注入 (需要 evorule-server 跑在 127.0.0.1:18080)";
      return;
    }
    creating = true;
    errorMsg = null;
    try {
      // 1. 创建 workspace
      const ws = await backend.createWorkspace({
        name: wsName.trim(),
        owner_id: "console",
        description: `建库向导创建 · 业务对象: ${allObjects.join(", ") || "无"}`,
      });
      createdWsId = ws.id;

      // 2. 经 translateToTransform 生成规则内容 (复用 server G1-G7 校验)
      //    用共享模型转换 (决策3), gte/gt 由 server 翻译成 not(lt)/not(all) (决策1)
      const summary = summarize({
        conditions: [{ field: ruleField, op: ruleOp, value: parseValue(ruleValue) }],
        actions: [{ type: ruleAction, role: ruleRole }],
      });
      const { condition, action_set } = businessRuleToTranslateInput({
        conditions: [{ field: ruleField, op: ruleOp, value: parseValue(ruleValue) }],
        actions: [{ type: ruleAction, role: ruleRole }],
      });
      const resp = await backend.translateToTransform({
        condition,
        action_set,
        metadata: { name: "我的第一条规则", description: summary },
      });

      const content = JSON.stringify(
        {
          id: "my-first-rule",
          version: 1,
          description: summary,
          transform: resp.transform,
        },
        null,
        2
      );

      // 3. 创建规则
      createdRuleId = await addRule(backend, ws.id, {
        name: "我的第一条规则",
        content,
        description: summary,
      });
    } catch (e) {
      errorMsg = `创建失败: ${(e as Error).message}`;
    } finally {
      creating = false;
    }
  }

  /** 进入工作台 (step 5 完成后) */
  async function enterWorkspace() {
    if (createdWsId && backend) {
      await selectWorkspace(backend, createdWsId);
    }
    goto("/workspace");
  }
</script>

<div class="onboarding-shell">
  <!-- === 顶部导航 (64px) === -->
  <header class="topbar">
    <div class="logo">evorule <span class="logo-sep">· 建库向导</span></div>

    <div class="step-indicators" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={totalSteps}>
      {#each STEP_LABELS as label, i}
        <span class="step-label" class:active={step === i + 1} class:done={step > i + 1}
          >{i + 1}. {label}</span
        >
        <span class="step-dot" class:active={step === i + 1} class:done={step > i + 1}></span>
      {/each}
    </div>

    <button class="exit-btn" onclick={exitWizard}>✕ 退出</button>
  </header>

  <!-- === 主内容 === -->
  <div class="main">
    {#if step === 1}
      <!-- Step 1: 选模板 -->
      <section class="step-content">
        <h2 class="step-title">选择你的起点</h2>
        <p class="step-subtitle"
          >选模板能直接获得预填规则和术语,选空白库则从零开始。</p
        >
        <div class="template-grid">
          {#each Object.entries(TEMPLATES) as [id, tpl]}
            <button
              class="template-card"
              class:selected={selectedTemplate === id}
              onclick={() => selectTemplate(id as TemplateId)}
            >
              <span class="tpl-icon">{tpl.icon}</span>
              <span class="tpl-name">{tpl.name}</span>
              <span class="tpl-desc">{tpl.desc}</span>
              <span class="tpl-hint">{tpl.hint}</span>
            </button>
          {/each}
        </div>
      </section>
    {:else if step === 2}
      <!-- Step 2: 命名 + 业务对象 -->
      <section class="step-content">
        <h2 class="step-title">给你的规则库命名</h2>
        <p class="step-subtitle"
          >给库起个名字,并选择业务对象(规则要处理的主角)。</p
        >

        <div class="form-group">
          <label for="ws-name">库名</label>
          <input
            id="ws-name"
            type="text"
            bind:value={wsName}
            placeholder="例如:XX 医院临床路径库"
          />
        </div>

        <div class="form-group">
          <label for="custom-object-input">业务对象</label>
          <div class="tag-group">
            {#each PRESET_OBJECTS as obj}
              <button
                class="tag-item"
                class:selected={selectedObjects.includes(obj)}
                onclick={() => toggleObject(obj)}
              >{obj}</button>
            {/each}
            {#each customObjects as obj}
              <button
                class="tag-item selected"
                onclick={() => (customObjects = customObjects.filter((o) => o !== obj))}
              >{obj} ✕</button>
            {/each}
          </div>
          <div class="custom-tag-row">
            <input
              id="custom-object-input"
              type="text"
              bind:value={customInput}
              placeholder="+ 自定义业务对象"
              onkeydown={(e) => e.key === "Enter" && (e.preventDefault(), addCustomObject())}
            />
            <button class="btn-secondary-sm" onclick={addCustomObject} disabled={!customInput.trim()}>添加</button>
          </div>
        </div>
      </section>
    {:else if step === 3}
      <!-- Step 3: 加第一条规则 -->
      <section class="step-content">
        <h2 class="step-title">加第一条规则</h2>
        <p class="step-subtitle">像填问卷一样填空,系统自动生成规则。</p>

        <div class="rule-form">
          <div class="field-row">
            <div class="field-item">
              <label>字段
                <select bind:value={ruleField}>
                  {#each BUILTIN_FIELDS as f}
                    <option value={f.id}>{f.label} ({f.id})</option>
                  {/each}
                </select>
              </label>
            </div>
            <div class="field-item">
              <label>比较符
                <select bind:value={ruleOp}>
                  {#each BUSINESS_OPS as o}
                    <option value={o.id}>{o.symbol} ({o.label})</option>
                  {/each}
                </select>
              </label>
            </div>
            <div class="field-item">
              <label>数值
                <input
                  type={findField(ruleField)?.inputType ?? "text"}
                  bind:value={ruleValue}
                  placeholder="阈值"
                />
              </label>
            </div>
          </div>
          <div class="field-row">
            <div class="field-item">
              <label>执行动作
                <select bind:value={ruleAction}>
                  {#each BUSINESS_ACTIONS as a}
                    <option value={a.id}>{a.label} ({a.desc})</option>
                  {/each}
                </select>
              </label>
            </div>
            <div class="field-item">
              <label>角色 / 渠道
                <input type="text" bind:value={ruleRole} placeholder="如 CFO" />
              </label>
            </div>
          </div>
        </div>

        <div class="translation-preview" aria-live="polite">
          {translationPreview}
        </div>

        <p class="action-hint">💡 规则负责识别业务情形并打标记;是否拦截由判定策略另行配置。</p>
      </section>
    {:else if step === 4}
      <!-- Step 4: 试运行 (客户端预览) -->
      <section class="step-content">
        <h2 class="step-title">试运行</h2>
        <p class="step-subtitle"
          >用一条模拟业务事件测试你的规则。<span class="preview-tag">预览</span></p
        >

        <div class="trial-box">
          <div class="trial-reminder">
            当前规则:<code>{findField(ruleField)?.label ?? ruleField} {opSymbol(ruleOp)} {ruleValue} → {actionLabel(ruleAction)} {ruleRole}</code>
          </div>
          <div class="field-row">
            <div class="field-item">
              <label>业务对象
                <input type="text" value={allObjects[0] ?? "—"} disabled />
              </label>
            </div>
            <div class="field-item">
              <label>申请人
                <input type="text" bind:value={trialApplicant} />
              </label>
            </div>
            <div class="field-item">
              <label>{findField(ruleField)?.label ?? ruleField}
                <input
                  type={findField(ruleField)?.inputType ?? "text"}
                  bind:value={trialValue}
                />
              </label>
            </div>
          </div>
          <div class="trial-result" class:triggered={trialResult === "triggered"} class:pass={trialResult === "auto-pass"}>
            {#if trialResult === "idle"}
              <span class="result-icon">⏳</span>
              <span class="result-text">点击下方 <strong>“提交测试”</strong> 查看结果</span>
            {:else if trialResult === "triggered"}
              <span class="result-icon">✅</span>
              <span class="result-text"
                >触发规则:<strong>{actionLabel(ruleAction)} {ruleRole}</strong> · 条件命中 ({trialValue} {opSymbol(ruleOp)} {ruleValue})</span
              >
            {:else}
              <span class="result-icon">⏳</span>
              <span class="result-text">未触发任何规则 · 自动通过 (预览)</span>
            {/if}
          </div>
        </div>
      </section>
    {:else if step === 5}
      <!-- Step 5: 完成 -->
      <section class="step-content complete-step">
        {#if creating}
          <div class="complete-box">
            <span class="big-icon">⏳</span>
            <h2 class="title">正在创建你的规则库…</h2>
            <p class="sub">正在向 server 写入 workspace 与首条规则,请稍候。</p>
          </div>
        {:else if errorMsg}
          <div class="complete-box">
            <span class="big-icon">⚠️</span>
            <h2 class="title">创建失败</h2>
            <p class="sub error-text">{errorMsg}</p>
            <button class="btn-secondary" onclick={() => { errorMsg = null; step = 4; }}>返回上一步</button>
          </div>
        {:else}
          <div class="complete-box">
            <span class="big-icon">🎉</span>
            <h2 class="title">你的规则库已就绪!</h2>
            <p class="sub">已创建工作空间 <strong>{wsName}</strong> 并保存 1 条规则。点击下方按钮进入工作台,开始管理更多规则。</p>
            <div class="stats">
              <div class="stat-item">
                <span class="num">1</span>
                <span class="label">规则</span>
              </div>
              <div class="stat-item">
                <span class="num">{allObjects.length}</span>
                <span class="label">业务对象</span>
              </div>
              <div class="stat-item">
                <span class="num">✅</span>
                <span class="label">状态</span>
              </div>
            </div>
          </div>
        {/if}
      </section>
    {/if}
  </div>

  <!-- === 底部操作栏 === -->
  <footer class="footer-actions">
    <button class="back-btn" onclick={prevStep} disabled={step === 1 || creating}>
      ← 上一步
    </button>
    {#if step === 4}
      <button class="next-btn" onclick={runTrial} disabled={!trialValue.trim()}>
        🚀 提交测试
      </button>
      <button class="next-btn" onclick={nextStep} disabled={trialResult === "idle" || creating}>
        下一步 →
      </button>
    {:else if step === 5}
      <button class="next-btn" onclick={enterWorkspace} disabled={creating || !!errorMsg}>
        🚀 进入工作台
      </button>
    {:else}
      <button class="next-btn" onclick={nextStep} disabled={!canAdvance}>
        下一步 →
      </button>
    {/if}
  </footer>
</div>

<style>
  .onboarding-shell {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 100vh;
    background: var(--bg-primary);
    overflow: hidden;
  }

  /* === 顶部导航 === */
  .topbar {
    height: 64px;
    min-height: 64px;
    display: flex;
    align-items: center;
    padding: 0 var(--spacing-lg);
    border-bottom: 1px solid var(--border);
    gap: var(--spacing-lg);
    background: var(--bg-primary);
    flex-shrink: 0;
  }

  .logo {
    font-size: var(--text-lg);
    font-weight: var(--font-semibold);
    color: var(--brand);
    letter-spacing: -0.3px;
  }

  .logo-sep {
    color: var(--text-secondary);
    font-weight: var(--font-light);
  }

  .step-indicators {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    flex: 1;
    justify-content: center;
  }

  .step-label {
    font-size: var(--text-xs);
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-weight: var(--font-medium);
    white-space: nowrap;
  }

  .step-label.active {
    color: var(--text-primary);
  }

  .step-label.done {
    color: var(--success);
  }

  .step-dot {
    width: 32px;
    height: 4px;
    background: var(--border);
    border-radius: 2px;
  }

  .step-dot.active {
    background: var(--brand);
  }

  .step-dot.done {
    background: var(--success);
  }

  .exit-btn {
    background: transparent;
    border: none;
    color: var(--text-secondary);
    font-size: var(--text-sm);
    cursor: pointer;
    padding: var(--spacing-xs) var(--spacing-sm);
    font-family: var(--font-sans);
  }

  .exit-btn:hover {
    color: var(--text-primary);
  }

  /* === 主内容 === */
  .main {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: var(--spacing-2xl) var(--spacing-2xl) var(--spacing-md);
    overflow-y: auto;
    gap: var(--spacing-lg);
  }

  .step-content {
    display: flex;
    flex-direction: column;
    max-width: 720px;
    margin: 0 auto;
    width: 100%;
    gap: var(--spacing-sm);
  }

  .step-title {
    font-size: var(--text-2xl);
    font-weight: var(--font-semibold);
    color: var(--text-primary);
    margin: 0;
    letter-spacing: -0.3px;
  }

  .step-subtitle {
    font-size: var(--text-sm);
    color: var(--text-secondary);
    margin: 0;
    line-height: 1.6;
  }

  /* === Step 1: 模板卡 === */
  .template-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: var(--spacing-md);
    margin-top: var(--spacing-sm);
  }

  .template-card {
    background: var(--bg-card);
    border: 2px solid var(--border);
    border-radius: var(--radius-md);
    padding: var(--spacing-lg) var(--spacing-md);
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    text-align: left;
    font-family: var(--font-sans);
    color: var(--text-primary);
    transition: none;
  }

  .template-card:hover {
    border-color: var(--text-secondary);
  }

  .template-card.selected {
    border-color: var(--brand);
    background: color-mix(in srgb, var(--brand) 4%, var(--bg-card));
  }

  .tpl-icon {
    font-size: 28px;
    line-height: 1.2;
  }

  .tpl-name {
    font-size: var(--text-base);
    font-weight: var(--font-semibold);
  }

  .tpl-desc {
    font-size: var(--text-sm);
    color: var(--text-secondary);
    line-height: 1.5;
  }

  .tpl-hint {
    font-size: var(--text-xs);
    color: var(--text-secondary);
    font-family: var(--font-mono);
    background: var(--bg-primary);
    padding: 2px var(--spacing-sm);
    border-radius: var(--radius-sm);
    align-self: flex-start;
    margin-top: var(--spacing-xs);
  }

  /* === 表单通用 === */
  .form-group {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    margin-bottom: var(--spacing-md);
    margin-top: var(--spacing-sm);
  }

  .form-group label {
    font-size: var(--text-xs);
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.3px;
    font-weight: var(--font-medium);
  }

  .form-group input,
  .rule-form input,
  .rule-form select,
  .trial-box input,
  .custom-tag-row input {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 10px var(--spacing-md);
    color: var(--text-primary);
    font-size: var(--text-base);
    font-family: var(--font-sans);
    outline: none;
    width: 100%;
  }

  .form-group input:focus,
  .rule-form input:focus,
  .rule-form select:focus,
  .trial-box input:focus,
  .custom-tag-row input:focus {
    border-color: var(--brand);
  }

  .form-group input::placeholder,
  .custom-tag-row input::placeholder {
    color: var(--text-secondary);
  }

  /* === 标签组 === */
  .tag-group {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-xs);
    margin-top: var(--spacing-xs);
  }

  .tag-item {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 4px var(--spacing-md);
    font-size: var(--text-sm);
    color: var(--text-primary);
    cursor: pointer;
    font-family: var(--font-sans);
    transition: none;
  }

  .tag-item:hover {
    border-color: var(--text-secondary);
  }

  .tag-item.selected {
    border-color: var(--brand);
    background: color-mix(in srgb, var(--brand) 8%, var(--bg-card));
    color: var(--brand);
  }

  .custom-tag-row {
    display: flex;
    gap: var(--spacing-sm);
    margin-top: var(--spacing-sm);
  }

  .custom-tag-row input {
    flex: 1;
  }

  .btn-secondary-sm {
    padding: var(--spacing-xs) var(--spacing-md);
    background: transparent;
    color: var(--text-primary);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    cursor: pointer;
    font-size: var(--text-sm);
    font-family: var(--font-sans);
  }

  .btn-secondary-sm:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* === Step 3: 规则表单 === */
  .rule-form {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: var(--spacing-lg) var(--spacing-lg);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
    margin-top: var(--spacing-sm);
  }

  .field-row {
    display: flex;
    gap: var(--spacing-md);
    align-items: flex-end;
  }

  .field-row .field-item {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .field-item label {
    font-size: var(--text-xs);
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.3px;
    font-weight: var(--font-medium);
    display: flex;
    flex-direction: column;
    gap: 4px;
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

  .action-hint {
    margin: 0;
    padding: var(--spacing-xs) var(--spacing-sm);
    font-size: var(--text-xs);
    color: var(--text-secondary);
    font-family: var(--font-sans);
  }

  /* === Step 4: 试运行 === */
  .preview-tag {
    display: inline-block;
    font-size: var(--text-xs);
    color: var(--warning);
    background: color-mix(in srgb, var(--warning) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--warning) 30%, var(--border));
    padding: 1px var(--spacing-sm);
    border-radius: var(--radius-sm);
    margin-left: var(--spacing-xs);
    font-family: var(--font-mono);
  }

  .trial-box {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: var(--spacing-lg) var(--spacing-lg);
    margin-top: var(--spacing-sm);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }

  .trial-reminder {
    font-size: var(--text-sm);
    color: var(--text-secondary);
  }

  .trial-reminder code {
    font-family: var(--font-mono);
    color: var(--text-primary);
    background: var(--bg-hover);
    padding: 1px var(--spacing-xs);
    border-radius: var(--radius-sm);
  }

  .trial-result {
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: var(--spacing-sm) var(--spacing-md);
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    font-size: var(--text-sm);
  }

  .trial-result.triggered {
    border-color: color-mix(in srgb, var(--success) 40%, var(--border));
  }

  .trial-result.pass {
    border-color: color-mix(in srgb, var(--warning) 40%, var(--border));
  }

  .result-icon {
    font-size: var(--text-lg);
  }

  .result-text {
    color: var(--text-primary);
  }

  .result-text strong {
    color: var(--success);
    font-weight: var(--font-medium);
  }

  /* === Step 5: 完成 === */
  .complete-step {
    flex: 1;
    justify-content: center;
  }

  .complete-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-lg) 0;
  }

  .big-icon {
    font-size: 56px;
    line-height: 1.2;
  }

  .complete-box .title {
    font-size: var(--text-2xl);
    font-weight: var(--font-semibold);
    color: var(--text-primary);
    margin: 0;
  }

  .complete-box .sub {
    font-size: var(--text-base);
    color: var(--text-secondary);
    max-width: 400px;
    line-height: 1.6;
    margin: 0;
  }

  .error-text {
    color: var(--danger);
    font-family: var(--font-mono);
    font-size: var(--text-sm);
  }

  .stats {
    display: flex;
    gap: var(--spacing-2xl);
    margin-top: var(--spacing-md);
  }

  .stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }

  .stat-item .num {
    font-family: var(--font-mono);
    font-size: var(--text-2xl);
    font-weight: var(--font-semibold);
    color: var(--brand);
  }

  .stat-item .label {
    font-size: var(--text-xs);
    color: var(--text-secondary);
  }

  /* === 底部操作栏 === */
  .footer-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-md) var(--spacing-2xl);
    border-top: 1px solid var(--border);
    flex-shrink: 0;
  }

  .back-btn {
    background: transparent;
    border: none;
    color: var(--text-secondary);
    font-size: var(--text-sm);
    cursor: pointer;
    font-family: var(--font-sans);
    padding: var(--spacing-xs) var(--spacing-sm);
  }

  .back-btn:hover:not(:disabled) {
    color: var(--text-primary);
  }

  .back-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .next-btn {
    background: var(--brand);
    border: 1px solid var(--brand);
    border-radius: var(--radius-md);
    padding: 10px var(--spacing-2xl);
    color: var(--bg-card);
    font-size: var(--text-base);
    font-weight: var(--font-medium);
    cursor: pointer;
    font-family: var(--font-sans);
    transition: none;
  }

  .next-btn:hover:not(:disabled) {
    background: var(--brand-strong);
    border-color: var(--brand-strong);
  }

  .next-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
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

  @media (max-width: 760px) {
    .template-grid {
      grid-template-columns: 1fr;
    }
    .field-row {
      flex-direction: column;
      align-items: stretch;
    }
    .step-indicators {
      display: none;
    }
  }
</style>
