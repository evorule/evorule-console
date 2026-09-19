// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 EvoRule Project
// evorule-console — LLM prompt 模板(流程 NL 转译器)
//
// 设计原则:
//   - 纯函数,零网络/零 LLM 依赖(公开仓 LLM-free 基调)——实现方(注入层)
//     调用本函数组装 prompt 后自行发送
//   - flow schema 标识符原样引用不翻译(node_id/node_type/params/form_ref/
//     threshold/edges/guard——协议词,R5 i18n 纪律)
//   - 语义上下文全部来自 ctx 资产投影(R4:节点语义/字段取值域不硬编码)
//   - 强约束 LLM 输出纯 JSON flow 对象,便于机器解析与 loadFlowAsset 投影
//
// 产物定位(红线):prompt 产物是**草稿**——填入画布由用户
// 可见可改,人点击编译才走既有 compileFlow→Draft→Publish 链;LLM 永不
// 直接 compile/publish。

import type { FlowTranspileContext } from "./types";

/**
 * 流程转译 prompt:自然语言 + 资产上下文 → flow JSON 草稿。
 *
 * ctx 由画布页从已加载的 node_types/scenes 资产映射(见 FlowTranspileContext);
 * 空资产如实呈现(nodeTypes/sceneFields 可为空数组,LLM 应据此拒绝虚构节点)。
 */
export function promptTranspileFlow(
  naturalLanguage: string,
  ctx: FlowTranspileContext,
): string {
  const nodeLines =
    ctx.nodeTypes.length === 0
      ? "（当前包未声明 node_types 资产）"
      : ctx.nodeTypes
          .map((t) => {
            const desc = t.description ? ` — ${t.description}` : "";
            const fields = (t.params_form ?? [])
              .map((f) => {
                const scene = f.scene_ref ? `(scene_ref:${f.scene_ref})` : "";
                return `${f.field_id}:${f.type}${scene}`;
              })
              .join(", ");
            return `- ${t.node_type}（${t.display_name}）${desc}${fields ? `；params 字段: ${fields}` : ""}`;
          })
          .join("\n");

  const fieldLines =
    ctx.sceneFields.length === 0
      ? "（场景中无已注册 path 的字段）"
      : ctx.sceneFields
          .map((f) => `- ${f.scene_id} / ${f.field_id} → path: ${f.path}`)
          .join("\n");

  const ruleLines =
    !ctx.existingRules || ctx.existingRules.length === 0
      ? ""
      : `\n存量规则参考(执行域已生效规则的 id 与描述,仅供学习结构模式与路径约定;\nflow 草稿是独立资产,**不要**在草稿中引用这些规则 id):\n${ctx.existingRules
          .map((r) => `- ${r.rule_id}${r.description ? `：${r.description}` : ""}`)
          .join("\n")}\n`;

  return `你是流程转译助手。请把以下自然语言描述转换为 evorule flow JSON 草稿。

evorule flow 资产(契约 v1.1 §4.6)是一个 JSON 对象:
  {
    "flow_id": "<流程 id>",
    "version": 1,
    "nodes": [ { "node_id": "n1", "node_type": "<节点类型>", "params": {...},
                 "form_ref": { "scene": "<场景 id>", "field": "<字段 id>" },
                 "threshold": <数值> } ],
    "edges": [ { "from": "n1", "to": "n2", "guard": "<守卫,可选>" } ]
  }
  - params/form_ref/threshold 仅在节点需要时出现;guard 仅审批出边需要

结构示例(仅演示 JSON 形状——node_type/场景/字段为虚构占位,**禁止照抄**,
实际输出必须只用下方白名单中的 node_type 与场景字段):
  {
    "flow_id": "expense_approval_flow",
    "version": 1,
    "nodes": [
      { "node_id": "n1", "node_type": "apply",
        "form_ref": { "scene": "expense", "field": "amount" } },
      { "node_id": "n2", "node_type": "approve", "threshold": 5000 },
      { "node_id": "n3", "node_type": "pay" }
    ],
    "edges": [
      { "from": "n1", "to": "n2" },
      { "from": "n2", "to": "n3", "guard": "approved" }
    ]
  }

可用节点类型(node_type 白名单,原样使用):
${nodeLines}

场景字段取值域(form_ref.field 只能取下列已注册 path 字段,R2):
${fieldLines}
${ruleLines}
硬约束(违反无法通过编译校验):
  1. 输出严格的 JSON 对象(无注释、无 markdown 包裹、无说明文字)
  2. node_type 只能取上方白名单;form_ref.field 只能取上方场景字段;
     禁止使用结构示例中的虚构类型(apply/approve/pay 仅为占位)
  3. 节点 id 用 n1/n2/… 顺序编号;flow_id 用小写 snake_case 英文
  4. v0 线性链:每个节点至多 1 条出边、1 条入边;edges 顺序与节点链顺序一致
  5. 审批类节点的出边加 "guard": "approved"
  6. 数值参数用数字类型,字符串用双引号
  7. 描述不明确时按合理默认值填充,不要拒绝

工具提示(可选能力,按需使用):若系统消息列出了可用的只读工具白名单,
可先调用其中规则/资产/审计查询类工具了解存量规则模式与系统实态,再输出
最终草稿;没有工具或认为不需要时,直接输出草稿即可,不要询问。

用户描述:
"""
${naturalLanguage}
"""

只输出 flow JSON:`;
}

/**
 * 流程修订 prompt(多轮转译第 2+ 轮;批次D)。
 *
 * 与首轮 promptTranspileFlow 同规格(spec/ctx 全量,取当时最新资产投影),
 * 仅把任务框定为"修订":LLM 在对话历史(前轮草稿)基础上输出**完整修订后的
 * flow JSON**,而不是差异或说明。修订指令原文入 prompt。
 */
export function promptReviseFlow(
  instruction: string,
  ctx: FlowTranspileContext,
): string {
  const base = promptTranspileFlow(instruction, ctx);
  return `注意:这是对前述对话中流程草稿的**修订请求**(历史对话含上一版草稿)。
请基于修订指令调整草稿,仍输出**完整修订后的 flow JSON**(不是差异、不是说明),
并继续遵守下方全部格式说明与硬约束。

${base}`;
}

