// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 EvoRule Project
// flow-model 单测——validateFlowDraft 展示层校验 + AI 草稿落画布投影

import { describe, expect, test } from 'vitest';
import {
  loadFlowAsset,
  validateFlowDraft,
  type FlowDraftCheckContext,
} from './flow-model';

const CTX: FlowDraftCheckContext = {
  nodeTypes: new Set(['start', 'approval', 'payment']),
  sceneFieldIds: new Set(['amount', 'applicant']),
};

const GOOD_FLOW = JSON.stringify({
  flow_id: 'canvas_flow',
  version: 1,
  nodes: [
    { node_id: 'n1', node_type: 'start' },
    { node_id: 'n2', node_type: 'approval', form_ref: { scene: 'expense', field: 'amount' } },
    { node_id: 'n3', node_type: 'payment' },
  ],
  edges: [
    { from: 'n1', to: 'n2' },
    { from: 'n2', to: 'n3', guard: 'approved' },
  ],
});

describe('validateFlowDraft（展示层校验,纯提示不阻断）', () => {
  test('合法草稿全绿', () => {
    const r = validateFlowDraft(GOOD_FLOW, CTX);
    expect(r.parseOk).toBe(true);
    expect(r.shapeOk).toBe(true);
    expect(r.unknownNodeTypes).toEqual([]);
    expect(r.unknownFormRefs).toEqual([]);
  });

  test('非 JSON → parseOk=false', () => {
    const r = validateFlowDraft('not json', CTX);
    expect(r.parseOk).toBe(false);
    expect(r.shapeOk).toBe(false);
  });

  test('缺骨架（nodes/edges/flow_id）→ shapeOk=false', () => {
    expect(validateFlowDraft('{"a":1}', CTX).shapeOk).toBe(false);
    expect(
      validateFlowDraft('{"flow_id":"f","nodes":[]}', CTX).shapeOk
    ).toBe(false);
    expect(
      validateFlowDraft('{"flow_id":"f","nodes":[],"edges":[]}', CTX).shapeOk
    ).toBe(true);
  });

  test('未知 node_type → 提示（不改产物）', () => {
    const bad = JSON.stringify({
      flow_id: 'f',
      nodes: [{ node_id: 'n1', node_type: 'typo_approval' }],
      edges: [],
    });
    const r = validateFlowDraft(bad, CTX);
    expect(r.parseOk).toBe(true);
    expect(r.unknownNodeTypes).toEqual(['n1']);
  });

  test('form_ref 越域 → R2 提示', () => {
    const bad = JSON.stringify({
      flow_id: 'f',
      nodes: [
        { node_id: 'n1', node_type: 'approval', form_ref: { scene: 'expense', field: 'nope' } },
      ],
      edges: [],
    });
    const r = validateFlowDraft(bad, CTX);
    expect(r.unknownFormRefs).toEqual(['n1']);
  });
});

describe('validateFlowDraft guard 取值域（契约 v1.2 out_guards 声明面）', () => {
  // out_guards 声明投影:approval 允许 approved;start/payment 未声明 = 禁 guard
  const CTX_G: FlowDraftCheckContext = {
    ...CTX,
    outGuards: new Map([['approval', new Set(['approved'])]]),
  };

  test('guard 在声明取值域内 → badGuards 空', () => {
    const r = validateFlowDraft(GOOD_FLOW, CTX_G);
    expect(r.badGuards).toEqual([]);
  });

  test('guard 越域（值不在声明集）→ badGuards 记 from 节点 id', () => {
    const bad = JSON.stringify({
      flow_id: 'f',
      nodes: [
        { node_id: 'n1', node_type: 'start' },
        { node_id: 'n2', node_type: 'payment' },
      ],
      edges: [{ from: 'n1', to: 'n2', guard: 'approved' }],
    });
    const r = validateFlowDraft(bad, CTX_G);
    expect(r.badGuards).toEqual(['n1']);
  });

  test('from 类型未声明 out_guards 却带 guard → 越域（缺省=禁 guard）', () => {
    const bad = JSON.stringify({
      flow_id: 'f',
      nodes: [{ node_id: 'n1', node_type: 'approval' }],
      edges: [{ from: 'n1', to: 'n2', guard: 'rejected' }],
    });
    const r = validateFlowDraft(bad, CTX_G);
    expect(r.badGuards).toEqual(['n1']);
  });

  test('ctx.outGuards 缺省 → 跳过 guard 校验（旧调用方兼容）', () => {
    const r = validateFlowDraft(GOOD_FLOW, CTX);
    expect(r.badGuards).toEqual([]);
  });

  test('无 guard 的边不在声明面语义内 → 不提示', () => {
    const ok = JSON.stringify({
      flow_id: 'f',
      nodes: [
        { node_id: 'n1', node_type: 'start' },
        { node_id: 'n2', node_type: 'approval' },
      ],
      edges: [{ from: 'n1', to: 'n2' }],
    });
    const r = validateFlowDraft(ok, CTX_G);
    expect(r.badGuards).toEqual([]);
  });
});

describe('loadFlowAsset（AI 草稿落画布投影路径）', () => {
  test('草稿对象 → 画布态（协议字段保留,坐标自动布局）', () => {
    const flow = JSON.parse(GOOD_FLOW);
    const { nodes, edges } = loadFlowAsset(flow);
    expect(nodes.map((n) => n.node_id)).toEqual(['n1', 'n2', 'n3']);
    expect(nodes[1].form_ref).toEqual({ scene: 'expense', field: 'amount' });
    expect(nodes.every((n) => typeof n.x === 'number' && typeof n.y === 'number')).toBe(true);
    expect(edges).toEqual([
      { from: 'n1', to: 'n2' },
      { from: 'n2', to: 'n3', guard: 'approved' },
    ]);
  });
});
