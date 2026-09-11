// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 EvoRule Project
// 通用流程画布模型层 — 画布节点/边状态 ↔ flow JSON（契约 v1.1 §4.6）双向投影
//
// 红线对齐:
//   - R4:本层只持有 flow 协议 schema（契约钉死的 node_id/node_type/params/
//     form_ref/threshold 结构）与布局坐标,零领域知识——节点语义全部来自
//     pack 的 node_types 资产声明;
//   - R3:buildFlowJson 产物是草稿（draft-only）,编译后仍不落库。
// 布局:线性自动布局（x 水平等距）;坐标是纯展示态,不进 flow JSON。

import type { FlowAssetRaw, FlowEdgeRaw, FlowNodeRaw } from "$lib/backend/plugin-packs";

/** 画布节点 = flow 协议字段 + 展示坐标 */
export interface CanvasNode {
  node_id: string;
  node_type: string;
  x: number;
  y: number;
  params?: Record<string, unknown>;
  form_ref?: { scene: string; field: string };
  threshold?: number;
}

/** 画布边 */
export interface CanvasEdge {
  from: string;
  to: string;
  guard?: string;
}

/** 节点卡片尺寸（拖动命中/连线锚点计算共用） */
export const NODE_W = 168;
export const NODE_H = 52;

/** 新建节点初始坐标步进（避免完全重叠） */
export function defaultPosition(index: number): { x: number; y: number } {
  return { x: 48 + (index % 5) * (NODE_W + 56), y: 48 + Math.floor(index / 5) * (NODE_H + 48) };
}

/** 下一个可用 node_id（n1/n2/…;跳过画布已有 id） */
export function nextNodeId(nodes: CanvasNode[]): string {
  let i = nodes.length + 1;
  while (nodes.some((n) => n.node_id === `n${i}`)) i += 1;
  return `n${i}`;
}

/** 画布态 → flow JSON 草稿（R3 draft-only;坐标不进产物） */
export function buildFlowJson(
  flowId: string,
  nodes: CanvasNode[],
  edges: CanvasEdge[]
): FlowAssetRaw {
  const flowNodes: FlowNodeRaw[] = nodes.map((n) => {
    const out: FlowNodeRaw = { node_id: n.node_id, node_type: n.node_type };
    if (n.params && Object.keys(n.params).length > 0) out.params = { ...n.params };
    if (n.form_ref) out.form_ref = { ...n.form_ref };
    if (n.threshold !== undefined) out.threshold = n.threshold;
    return out;
  });
  const flowEdges: FlowEdgeRaw[] = edges.map((e) =>
    e.guard ? { from: e.from, to: e.to, guard: e.guard } : { from: e.from, to: e.to }
  );
  return { flow_id: flowId, version: 1, nodes: flowNodes, edges: flowEdges };
}

/** flow JSON → 画布态（线性链水平自动布局;协议外字段原样丢弃） */
export function loadFlowAsset(flow: FlowAssetRaw): { nodes: CanvasNode[]; edges: CanvasEdge[] } {
  const nodes: CanvasNode[] = flow.nodes.map((n, i) => ({
    node_id: n.node_id,
    node_type: n.node_type,
    x: defaultPosition(i).x,
    y: defaultPosition(i).y,
    ...(n.params ? { params: { ...n.params } } : {}),
    ...(n.form_ref ? { form_ref: { ...n.form_ref } } : {}),
    ...(n.threshold !== undefined ? { threshold: n.threshold } : {})
  }));
  const edges: CanvasEdge[] = flow.edges.map((e) =>
    e.guard ? { from: e.from, to: e.to, guard: e.guard } : { from: e.from, to: e.to }
  );
  return { nodes, edges };
}

/** 贝塞尔连线控制点（水平流向;源右缘 → 目标左缘） */
export function bezierPath(
  from: { x: number; y: number },
  to: { x: number; y: number }
): string {
  const x1 = from.x + NODE_W;
  const y1 = from.y + NODE_H / 2;
  const x2 = to.x;
  const y2 = to.y + NODE_H / 2;
  const dx = Math.max(48, Math.abs(x2 - x1) / 2);
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}
