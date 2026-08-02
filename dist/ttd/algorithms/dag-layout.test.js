// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 EvoRule Project
// dag-layout.js 纯函数单元测试(无 DOM 依赖)
//
// 适配说明(evorule-console 内嵌副本):
//   - 原测试在 time-travel-debugger/tests/unit/dag-layout.test.mjs 用 node:test
//   - evorule-console 统一用 vitest,本文件为 vitest 版本
//   - 测试逻辑与原版一致,仅替换 assert API
//
// 运行: npx vitest run src/lib/ttd/algorithms/dag-layout.test.ts
import { describe, test, expect } from 'vitest';
import { layoutDag, LAYOUT_CONST } from './dag-layout.js';
// ============ 常量 ============
const { NODE_W, NODE_H, LAYER_GAP, NODE_GAP } = LAYOUT_CONST;
const LAYER_HEIGHT = NODE_H + LAYER_GAP; // 44 + 60 = 104
// ============ 辅助 ============
/** 构建最小 causal chain entry */
function entry(fact_id, cause = null, extra = {}) {
    return {
        fact_id,
        fact_type: 'StateTransition',
        logical_time: fact_id,
        content_hash: `hash_${fact_id}`,
        cause,
        ...extra
    };
}
/** 按 fact_id 查找布局后的节点 */
function findNode(result, fact_id) {
    return result.nodes.find((n) => n.fact_id === fact_id);
}
// ============ layoutDag — 空输入 ============
describe('layoutDag — 空输入', () => {
    test('null → 空结果', () => {
        // layoutDag 的 JS 源签名推断为 any[],null 用 as any 绕过(运行时已处理 null)
        const r = layoutDag(null);
        expect(r).toEqual({ nodes: [], edges: [], layerCount: 0, width: 0, height: 0 });
    });
    test('空数组 → 空结果', () => {
        const r = layoutDag([]);
        expect(r).toEqual({ nodes: [], edges: [], layerCount: 0, width: 0, height: 0 });
    });
});
// ============ layoutDag — 单节点 ============
describe('layoutDag — 单节点', () => {
    test('单个 root → layer 0,x=0,y=0', () => {
        const r = layoutDag([entry(1)]);
        expect(r.nodes.length).toBe(1);
        expect(r.edges.length).toBe(0);
        expect(r.layerCount).toBe(1);
        const n = r.nodes[0];
        expect(n.fact_id).toBe(1);
        expect(n.layer).toBe(0);
        expect(n.x).toBe(0); // 单节点居中于 x=0
        expect(n.y).toBe(0);
    });
    test('单节点保留原始字段', () => {
        const e = entry(1, null, { fact_type: 'Command', logical_time: 42, content_hash: 'abc' });
        const r = layoutDag([e]);
        const n = r.nodes[0];
        expect(n.fact_type).toBe('Command');
        expect(n.logical_time).toBe(42);
        expect(n.content_hash).toBe('abc');
        expect(n.cause).toBeNull();
    });
});
// ============ layoutDag — 线性链 ============
describe('layoutDag — 线性链(A→B→C)', () => {
    const chain = [entry(1), entry(2, 1), entry(3, 2)];
    const r = layoutDag(chain);
    test('3 节点 2 边', () => {
        expect(r.nodes.length).toBe(3);
        expect(r.edges.length).toBe(2);
    });
    test('层次分配:0, 1, 2', () => {
        expect(findNode(r, 1).layer).toBe(0);
        expect(findNode(r, 2).layer).toBe(1);
        expect(findNode(r, 3).layer).toBe(2);
    });
    test('Y 定位:layer × (NODE_H + LAYER_GAP)', () => {
        expect(findNode(r, 1).y).toBe(0);
        expect(findNode(r, 2).y).toBe(LAYER_HEIGHT);
        expect(findNode(r, 3).y).toBe(2 * LAYER_HEIGHT);
    });
    test('X 定位:每层 1 节点,x=0', () => {
        r.nodes.forEach((n) => expect(n.x).toBe(0));
    });
    test('layerCount = 3', () => {
        expect(r.layerCount).toBe(3);
    });
    test('边正确:{1→2, 2→3}', () => {
        expect(r.edges.some((e) => e.from === 1 && e.to === 2)).toBe(true);
        expect(r.edges.some((e) => e.from === 2 && e.to === 3)).toBe(true);
    });
});
// ============ layoutDag — 分支树 ============
describe('layoutDag — 分支(A→B, A→C)', () => {
    const chain = [entry(1), entry(2, 1), entry(3, 1)];
    const r = layoutDag(chain);
    test('root layer 0,两个子节点 layer 1', () => {
        expect(findNode(r, 1).layer).toBe(0);
        expect(findNode(r, 2).layer).toBe(1);
        expect(findNode(r, 3).layer).toBe(1);
    });
    test('同层 2 节点对称分布(x 互为相反数)', () => {
        const n2 = findNode(r, 2);
        const n3 = findNode(r, 3);
        expect(n2.x).toBe(-n3.x);
        expect(n2.x).not.toBe(0); // 不在中心
    });
    test('同层节点间距 = NODE_W + NODE_GAP', () => {
        const n2 = findNode(r, 2);
        const n3 = findNode(r, 3);
        const dist = Math.abs(n3.x - n2.x);
        expect(dist).toBe(NODE_W + NODE_GAP);
    });
    test('root x=0(单节点层)', () => {
        expect(findNode(r, 1).x).toBe(0);
    });
    test('layerCount = 2', () => {
        expect(r.layerCount).toBe(2);
    });
});
// ============ layoutDag — 深层分支 ============
describe('layoutDag — 深层分支(A→B→D, A→C→E)', () => {
    const chain = [
        entry(1), // A, root
        entry(2, 1), // B, child of A
        entry(3, 1), // C, child of A
        entry(4, 2), // D, child of B
        entry(5, 3), // E, child of C
    ];
    const r = layoutDag(chain);
    test('层次:A=0, B/C=1, D/E=2', () => {
        expect(findNode(r, 1).layer).toBe(0);
        expect(findNode(r, 2).layer).toBe(1);
        expect(findNode(r, 3).layer).toBe(1);
        expect(findNode(r, 4).layer).toBe(2);
        expect(findNode(r, 5).layer).toBe(2);
    });
    test('layerCount = 3', () => {
        expect(r.layerCount).toBe(3);
    });
    test('4 条边', () => {
        expect(r.edges.length).toBe(4);
        expect(r.edges.some((e) => e.from === 1 && e.to === 2)).toBe(true);
        expect(r.edges.some((e) => e.from === 1 && e.to === 3)).toBe(true);
        expect(r.edges.some((e) => e.from === 2 && e.to === 4)).toBe(true);
        expect(r.edges.some((e) => e.from === 3 && e.to === 5)).toBe(true);
    });
    test('Layer 2 两节点对称', () => {
        const n4 = findNode(r, 4);
        const n5 = findNode(r, 5);
        expect(n4.layer).toBe(2);
        expect(n5.layer).toBe(2);
        expect(n4.x).toBe(-n5.x);
    });
});
// ============ layoutDag — 多 root(森林) ============
describe('layoutDag — 森林(多 root)', () => {
    test('两个独立 root → 同 layer 0,水平展开', () => {
        const chain = [entry(1), entry(2)]; // 两个 root(cause=null)
        const r = layoutDag(chain);
        expect(r.nodes.length).toBe(2);
        expect(findNode(r, 1).layer).toBe(0);
        expect(findNode(r, 2).layer).toBe(0);
        // 同层 2 节点,对称分布
        const n1 = findNode(r, 1);
        const n2 = findNode(r, 2);
        expect(n1.x).toBe(-n2.x);
        expect(Math.abs(n2.x - n1.x)).toBe(NODE_W + NODE_GAP);
    });
    test('3 个独立 root → 同 layer 0,三节点均匀分布', () => {
        const chain = [entry(1), entry(2), entry(3)];
        const r = layoutDag(chain);
        const nodes = r.nodes;
        expect(nodes.length).toBe(3);
        nodes.forEach((n) => expect(n.layer).toBe(0));
        // 间距一致
        const sorted = [...nodes].sort((a, b) => a.x - b.x);
        const gap1 = sorted[1].x - sorted[0].x;
        const gap2 = sorted[2].x - sorted[1].x;
        expect(gap1).toBe(gap2);
        expect(gap1).toBe(NODE_W + NODE_GAP);
    });
});
// ============ layoutDag — 无 root 回退 ============
describe('layoutDag — 无 root 回退', () => {
    test('所有 entry 有 cause,但 cause 不在 chain 中 → 首条当 root', () => {
        // fact_id 2 的 cause=1,但 fact_id 1 不在 chain 中
        const chain = [entry(2, 1), entry(3, 2)];
        const r = layoutDag(chain);
        // 首条(entry 2)被当作 root → layer 0
        expect(findNode(r, 2).layer).toBe(0);
        expect(findNode(r, 3).layer).toBe(1);
        expect(r.layerCount).toBe(2);
    });
    test('无 root 时边仍包含 cause 指向的外部 fact_id', () => {
        const chain = [entry(2, 1)];
        const r = layoutDag(chain);
        // 边 {from:1, to:2} 仍存在(1 不在 nodeMap,但边已记录)
        expect(r.edges.length).toBe(1);
        expect(r.edges[0].from).toBe(1);
        expect(r.edges[0].to).toBe(2);
    });
});
// ============ layoutDag — 孤立节点 ============
describe('layoutDag — 孤立节点', () => {
    test('cause 指向不存在 fact_id 的节点 → layer 0', () => {
        // 1 是 root,2 的 cause=99(不存在),3 的 cause=1
        const chain = [entry(1), entry(2, 99), entry(3, 1)];
        const r = layoutDag(chain);
        expect(findNode(r, 1).layer).toBe(0);
        expect(findNode(r, 3).layer).toBe(1);
        // 2 的 cause=99 不在 nodeMap → BFS 不到达 → 孤立 → layer 0
        expect(findNode(r, 2).layer).toBe(0);
    });
});
// ============ layoutDag — 尺寸计算 ============
describe('layoutDag — 尺寸计算', () => {
    test('单节点尺寸正确', () => {
        const r = layoutDag([entry(1)]);
        // width = maxX*2 + 40 = 70*2 + 40 = 180
        // height = 1 * LAYER_HEIGHT - LAYER_GAP + 40 = 104 - 60 + 40 = 84
        expect(r.width).toBe(NODE_W + 40); // 180
        expect(r.height).toBe(NODE_H + 40); // 84
    });
    test('线性链 3 层高度正确', () => {
        const r = layoutDag([entry(1), entry(2, 1), entry(3, 2)]);
        // height = 3 * LAYER_HEIGHT - LAYER_GAP + 40 = 312 - 60 + 40 = 292
        expect(r.height).toBe(3 * LAYER_HEIGHT - LAYER_GAP + 40);
    });
    test('分支宽度 > 单节点宽度', () => {
        const linear = layoutDag([entry(1), entry(2, 1), entry(3, 2)]);
        const branch = layoutDag([entry(1), entry(2, 1), entry(3, 1)]);
        expect(branch.width).toBeGreaterThan(linear.width);
    });
    test('空输入尺寸为 0', () => {
        expect(layoutDag(null).width).toBe(0);
        expect(layoutDag(null).height).toBe(0);
        expect(layoutDag([]).width).toBe(0);
        expect(layoutDag([]).height).toBe(0);
    });
});
// ============ layoutDag — 节点字段完整性 ============
describe('layoutDag — 节点字段完整性', () => {
    test('每个节点包含所有布局字段', () => {
        const chain = [entry(1), entry(2, 1)];
        const r = layoutDag(chain);
        r.nodes.forEach((n) => {
            expect('fact_id' in n).toBe(true);
            expect('fact_type' in n).toBe(true);
            expect('logical_time' in n).toBe(true);
            expect('content_hash' in n).toBe(true);
            expect('cause' in n).toBe(true);
            expect('x' in n).toBe(true);
            expect('y' in n).toBe(true);
            expect('layer' in n).toBe(true);
        });
    });
});
// ============ LAYOUT_CONST ============
describe('LAYOUT_CONST', () => {
    test('导出 4 个常量', () => {
        expect(typeof LAYOUT_CONST).toBe('object');
        expect(Object.keys(LAYOUT_CONST).length).toBe(4);
    });
    test('常量值正确', () => {
        expect(LAYOUT_CONST.NODE_W).toBe(140);
        expect(LAYOUT_CONST.NODE_H).toBe(44);
        expect(LAYOUT_CONST.LAYER_GAP).toBe(60);
        expect(LAYOUT_CONST.NODE_GAP).toBe(30);
    });
});
// ============ 端到端综合场景 ============
describe('layoutDag — 综合:evorule causal chain', () => {
    test('典型 causal chain 布局', () => {
        // 模拟 evorule 审计链:Command → StateTransition → Command → StateTransition
        const chain = [
            entry(100, null, { fact_type: 'Command' }),
            entry(101, 100, { fact_type: 'StateTransition' }),
            entry(102, 101, { fact_type: 'Command' }),
            entry(103, 102, { fact_type: 'StateTransition' }),
        ];
        const r = layoutDag(chain);
        // 4 层线性链
        expect(r.layerCount).toBe(4);
        expect(r.nodes.length).toBe(4);
        expect(r.edges.length).toBe(3);
        // Y 递增
        const ys = r.nodes.map((n) => n.y);
        expect(ys).toEqual([0, LAYER_HEIGHT, 2 * LAYER_HEIGHT, 3 * LAYER_HEIGHT]);
        // fact_type 保留
        expect(findNode(r, 100).fact_type).toBe('Command');
        expect(findNode(r, 101).fact_type).toBe('StateTransition');
    });
    test('带分支的复杂因果图', () => {
        //       1(root)
        //      / \
        //     2   3
        //    /     \
        //   4       5
        const chain = [
            entry(1),
            entry(2, 1),
            entry(3, 1),
            entry(4, 2),
            entry(5, 3),
        ];
        const r = layoutDag(chain);
        expect(r.layerCount).toBe(3);
        expect(r.nodes.length).toBe(5);
        expect(r.edges.length).toBe(4);
        // 验证所有父子关系
        const parentOf = new Map();
        chain.forEach((e) => { if (e.cause != null)
            parentOf.set(e.fact_id, e.cause); });
        r.nodes.forEach((n) => {
            if (n.cause != null) {
                const parent = findNode(r, n.cause);
                expect(parent).toBeTruthy();
                expect(parent.layer).toBeLessThan(n.layer);
            }
        });
    });
});
