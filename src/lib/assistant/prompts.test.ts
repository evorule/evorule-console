// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 EvoRule Project
// promptTranspileFlow/promptReviseFlow 单测——纯函数,断言资产上下文/schema 标识符/NL 入 prompt

import { describe, expect, test } from 'vitest';
import { promptReviseFlow, promptTranspileFlow } from './prompts';
import type { FlowTranspileContext } from './types';

const CTX: FlowTranspileContext = {
  nodeTypes: [
    {
      node_type: 'approval',
      display_name: '审批',
      description: '人工审批节点',
      params_form: [
        { field_id: 'role', type: 'text' },
        { field_id: 'threshold', type: 'number' },
        { field_id: 'form_ref', type: 'scene_field', scene_ref: 'expense' },
      ],
    },
    { node_type: 'payment', display_name: '打款' },
  ],
  sceneFields: [
    { scene_id: 'expense', field_id: 'amount', path: 'expense.amount' },
    { scene_id: 'expense', field_id: 'applicant', path: 'expense.applicant' },
  ],
};

describe('promptTranspileFlow', () => {
  test('flow schema 协议标识符原样入 prompt（R5 i18n）', () => {
    const p = promptTranspileFlow('描述', CTX);
    for (const id of ['flow_id', 'version', 'nodes', 'edges', 'node_id', 'node_type', 'params', 'form_ref', 'threshold', 'guard']) {
      expect(p).toContain(id);
    }
  });

  test('资产上下文动态入 prompt（R4:node_type/字段/取值域原文）', () => {
    const p = promptTranspileFlow('描述', CTX);
    // node_types 投影
    expect(p).toContain('approval');
    expect(p).toContain('审批');
    expect(p).toContain('人工审批节点');
    expect(p).toContain('role:text');
    expect(p).toContain('form_ref:scene_field(scene_ref:expense)');
    // scene path 取值域（R2）
    expect(p).toContain('expense.amount');
    expect(p).toContain('expense.applicant');
  });

  test('用户 NL 原文入 prompt', () => {
    const nl = '员工提交报销,主管审批后财务打款';
    expect(promptTranspileFlow(nl, CTX)).toContain(nl);
  });

  test('空资产如实呈现（不虚构节点/字段）', () => {
    const p = promptTranspileFlow('描述', { nodeTypes: [], sceneFields: [] });
    expect(p).toContain('未声明 node_types 资产');
    expect(p).toContain('无已注册 path 的字段');
  });

  test('线性链与审批 guard 约束入 prompt', () => {
    const p = promptTranspileFlow('描述', CTX);
    expect(p).toContain('1 条出边');
    expect(p).toContain('"guard": "approved"');
  });

  test('few-shot 结构示例入 prompt 且标注禁止照抄（prompt 调优）', () => {
    const p = promptTranspileFlow('描述', CTX);
    // 形状示例:完整 flow 骨架(guard/formed/threshold/线性链形状)
    expect(p).toContain('expense_approval_flow');
    expect(p).toContain('"flow_id": "expense_approval_flow"');
    expect(p).toContain('"threshold": 5000');
    expect(p).toContain('"guard": "approved"');
    // 防照抄标注:示例类型是虚构占位,输出必须取白名单
    expect(p).toContain('禁止照抄');
    expect(p).toContain('禁止使用结构示例中的虚构类型');
    // 约束强化:flow_id snake_case + edges 顺序
    expect(p).toContain('snake_case');
    expect(p).toContain('edges 顺序与节点链顺序一致');
  });
});

// ---- UV-178 批次D:存量规则投影 + 工具引导句 + 多轮修订 prompt ----

describe('promptTranspileFlow 存量规则投影(UV-178 批次D)', () => {
  test('existingRules 非空时渲染参考节,且明示禁止在草稿中引用规则 id', () => {
    const ctx: FlowTranspileContext = {
      ...CTX,
      existingRules: [
        { rule_id: 'finance.amount_threshold', description: '金额阈值审批' },
        { rule_id: 'finance.material_check' },
      ],
    };
    const p = promptTranspileFlow('描述', ctx);
    expect(p).toContain('存量规则参考');
    expect(p).toContain('finance.amount_threshold');
    expect(p).toContain('金额阈值审批');
    expect(p).toContain('finance.material_check');
    // 防误用:参考不等于引用
    expect(p).toContain('不要**在草稿中引用这些规则 id');
  });

  test('existingRules 缺省/为空时不渲染参考节（旧调用方兼容）', () => {
    const p1 = promptTranspileFlow('描述', CTX);
    const p2 = promptTranspileFlow('描述', { ...CTX, existingRules: [] });
    expect(p1).not.toContain('存量规则参考');
    expect(p2).not.toContain('存量规则参考');
  });

  test('server 通道工具引导句恒在(无工具名硬编码,R4/插件实现细节解耦)', () => {
    const p = promptTranspileFlow('描述', CTX);
    expect(p).toContain('只读工具白名单');
    expect(p).toContain('再输出');
    // 不含 ai-plugin 具体工具名(prompt 与插件实现解耦)
    expect(p).not.toContain('rules_list');
    expect(p).not.toContain('pack_assets');
  });
});

describe('promptReviseFlow(UV-178 批次D 多轮修订)', () => {
  test('修订框定入 prompt:完整输出、非差异', () => {
    const p = promptReviseFlow('把审批阈值改成 10000', CTX);
    expect(p).toContain('修订请求');
    expect(p).toContain('完整修订后的 flow JSON');
    expect(p).toContain('把审批阈值改成 10000');
  });

  test('修订 prompt 保留首轮全部规格(spec/白名单/取值域/工具引导)', () => {
    const p = promptReviseFlow('改阈值', CTX);
    // spec 与资产上下文全量在(修订轮仍以最新 ctx 投影)
    expect(p).toContain('approval');
    expect(p).toContain('expense.amount');
    expect(p).toContain('只输出 flow JSON');
    expect(p).toContain('只读工具白名单');
  });

  test('修订 prompt 同样携带存量规则投影', () => {
    const ctx: FlowTranspileContext = {
      ...CTX,
      existingRules: [{ rule_id: 'r1', description: '示例' }],
    };
    const p = promptReviseFlow('改阈值', ctx);
    expect(p).toContain('存量规则参考');
    expect(p).toContain('r1');
  });
});
