// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 EvoRule Project
// json-tree.js 纯函数单元测试(无 DOM 依赖)
//
// 适配说明(evorule-console 内嵌副本):
//   - 原测试在 time-travel-debugger/tests/unit/json-tree.test.mjs 用 node:test
//   - evorule-console 统一用 vitest,本文件为 vitest 版本
//   - 测试逻辑与原版一致,仅替换 assert API
//
// 运行: npx vitest run src/lib/ttd/algorithms/json-tree.test.ts

import { describe, test, expect } from 'vitest';
import { buildTree, countNodes } from './json-tree.js';

// ============ 内部常量(未导出,但行为可测) ============

const MAX_DEPTH = 12;
const MAX_CHILDREN = 1000;

// ============ 辅助 ============

/** 在 children 中按 key 查找子节点 */
function findChild(node: any, key: string | number): any {
  return (node.children || []).find((c: any) => c.key === key);
}

/** 断言叶子节点结构 */
function assertLeaf(node: any, kind: string, key: string | number | null): void {
  expect(node.kind).toBe(kind);
  expect(node.children).toBeNull();
  expect(node.size).toBe(0);
  expect(node.key).toBe(key);
}

/** 构建嵌套 n 层的对象:{a:{a:{...{a: 'leaf'}...}}} */
function deepNested(n: number): any {
  let v: any = 'leaf';
  for (let i = 0; i < n; i++) v = { a: v };
  return v;
}

// ============ buildTree — 原始类型分类 ============

describe('buildTree — 原始类型分类', () => {
  test('null → kind "null"', () => {
    const r = buildTree(null);
    assertLeaf(r, 'null', null);
    expect(r.value).toBeNull();
    expect(r.depth).toBe(0);
  });

  test('数字 → kind "number"', () => {
    const r = buildTree(42);
    assertLeaf(r, 'number', null);
    expect(r.value).toBe(42);
  });

  test('字符串 → kind "string"', () => {
    const r = buildTree('hello');
    assertLeaf(r, 'string', null);
    expect(r.value).toBe('hello');
  });

  test('布尔 → kind "boolean"', () => {
    const r = buildTree(true);
    assertLeaf(r, 'boolean', null);
    expect(r.value).toBe(true);
  });

  test('零 → kind "number", value 0', () => {
    const r = buildTree(0);
    assertLeaf(r, 'number', null);
    expect(r.value).toBe(0);
  });

  test('空字符串 → kind "string", value ""', () => {
    const r = buildTree('');
    assertLeaf(r, 'string', null);
    expect(r.value).toBe('');
  });

  test('false → kind "boolean", value false', () => {
    const r = buildTree(false);
    assertLeaf(r, 'boolean', null);
    expect(r.value).toBe(false);
  });

  test('负数和浮点数', () => {
    expect(buildTree(-1).value).toBe(-1);
    expect(buildTree(3.14).value).toBe(3.14);
  });

  test('undefined → kind "undefined"(边界:非 JSON 值)', () => {
    const r = buildTree(undefined);
    expect(r.kind).toBe('undefined');
    expect(r.value).toBeUndefined();
    expect(r.children).toBeNull();
  });
});

// ============ buildTree — key 和 depth 传递 ============

describe('buildTree — key 和 depth 传递', () => {
  test('根节点 key = null, depth = 0', () => {
    const r = buildTree(42);
    expect(r.key).toBeNull();
    expect(r.depth).toBe(0);
  });

  test('对象字段的 key = 字段名(string)', () => {
    const r = buildTree({ counter: 0 });
    const child = findChild(r, 'counter');
    expect(child.key).toBe('counter');
    expect(child.depth).toBe(1);
  });

  test('数组元素的 key = 索引(number)', () => {
    const r = buildTree([10, 20, 30]);
    expect(r.children[0].key).toBe(0);
    expect(r.children[1].key).toBe(1);
    expect(r.children[2].key).toBe(2);
  });

  test('depth 逐层递增', () => {
    const r = buildTree({ a: { b: { c: 1 } } });
    expect(r.depth).toBe(0);
    const a = findChild(r, 'a');
    expect(a.depth).toBe(1);
    const b = findChild(a, 'b');
    expect(b.depth).toBe(2);
    const c = findChild(b, 'c');
    expect(c.depth).toBe(3);
  });

  test('自定义 key 参数透传', () => {
    const r = buildTree(42, 'myKey');
    expect(r.key).toBe('myKey');
  });

  test('自定义 depth 参数透传', () => {
    const r = buildTree(42, null, 5);
    expect(r.depth).toBe(5);
  });
});

// ============ buildTree — 对象 ============

describe('buildTree — 对象', () => {
  test('空对象 → children=[], size=0', () => {
    const r = buildTree({});
    expect(r.kind).toBe('object');
    expect(r.value).toBeNull(); // 容器 value 为 null
    expect(r.children.length).toBe(0);
    expect(r.size).toBe(0);
  });

  test('单字段对象', () => {
    const r = buildTree({ a: 1 });
    expect(r.kind).toBe('object');
    expect(r.size).toBe(1);
    expect(r.children.length).toBe(1);
    const a = r.children[0];
    expect(a.kind).toBe('number');
    expect(a.value).toBe(1);
    expect(a.key).toBe('a');
  });

  test('多字段对象 → size = 字段数', () => {
    const r = buildTree({ a: 1, b: 'x', c: true });
    expect(r.size).toBe(3);
    expect(r.children.length).toBe(3);
  });

  test('嵌套对象递归构建', () => {
    const r = buildTree({ outer: { inner: 42 } });
    expect(r.kind).toBe('object');
    const outer = findChild(r, 'outer');
    expect(outer.kind).toBe('object');
    expect(outer.value).toBeNull();
    const inner = findChild(outer, 'inner');
    expect(inner.kind).toBe('number');
    expect(inner.value).toBe(42);
  });

  test('对象字段保留所有 key', () => {
    const r = buildTree({ x: 1, y: 2, z: 3 });
    const keys = r.children.map((c: any) => c.key);
    expect(keys.includes('x')).toBe(true);
    expect(keys.includes('y')).toBe(true);
    expect(keys.includes('z')).toBe(true);
  });

  test('容器 value 始终为 null', () => {
    const r = buildTree({ a: 1 });
    expect(r.value).toBeNull();
    const nested = buildTree({ a: { b: 2 } });
    const a = findChild(nested, 'a');
    expect(a.value).toBeNull();
  });
});

// ============ buildTree — 数组 ============

describe('buildTree — 数组', () => {
  test('空数组 → children=[], size=0', () => {
    const r = buildTree([]);
    expect(r.kind).toBe('array');
    expect(r.value).toBeNull();
    expect(r.children.length).toBe(0);
    expect(r.size).toBe(0);
  });

  test('单元素数组', () => {
    const r = buildTree([42]);
    expect(r.kind).toBe('array');
    expect(r.size).toBe(1);
    expect(r.children[0].kind).toBe('number');
    expect(r.children[0].value).toBe(42);
    expect(r.children[0].key).toBe(0);
  });

  test('多元素数组 → size = length', () => {
    const r = buildTree([1, 'a', true, null]);
    expect(r.size).toBe(4);
    expect(r.children[0].kind).toBe('number');
    expect(r.children[1].kind).toBe('string');
    expect(r.children[2].kind).toBe('boolean');
    expect(r.children[3].kind).toBe('null');
  });

  test('嵌套数组递归构建', () => {
    const r = buildTree([[1, 2], [3, 4]]);
    expect(r.kind).toBe('array');
    const inner0 = r.children[0];
    expect(inner0.kind).toBe('array');
    expect(inner0.children[0].value).toBe(1);
    expect(inner0.children[1].value).toBe(2);
  });

  test('数组元素为对象 → 递归', () => {
    const r = buildTree([{ x: 1 }, { y: 2 }]);
    const elem0 = r.children[0];
    expect(elem0.kind).toBe('object');
    expect(findChild(elem0, 'x').value).toBe(1);
  });

  test('混合嵌套:对象含数组含对象', () => {
    const r = buildTree({ items: [{ name: 'a' }] });
    const items = findChild(r, 'items');
    expect(items.kind).toBe('array');
    const item0 = items.children[0];
    expect(item0.kind).toBe('object');
    expect(findChild(item0, 'name').value).toBe('a');
  });
});

// ============ buildTree — 深度截断 ============

describe('buildTree — 深度截断(MAX_DEPTH=12)', () => {
  test('depth=12 的容器 → 截断为 "[深度截断]" 字符串', () => {
    const r = buildTree({ a: 1 }, null, MAX_DEPTH);
    expect(r.kind).toBe('string');
    expect(r.value).toBe('[深度截断]');
    expect(r.children).toBeNull();
    expect(r.size).toBe(0);
    expect(r.depth).toBe(MAX_DEPTH);
  });

  test('depth=11 的容器 → 正常处理(子节点在 depth=12)', () => {
    const r = buildTree({ a: 1 }, null, MAX_DEPTH - 1);
    expect(r.kind).toBe('object');
    expect(r.size).toBe(1);
    const a = findChild(r, 'a');
    expect(a.kind).toBe('number');
    expect(a.depth).toBe(MAX_DEPTH);
  });

  test('depth=12 的非容器 → 正常叶子(不截断)', () => {
    // 截断只对容器生效;原始类型即使在 MAX_DEPTH 也正常返回
    const r = buildTree(42, null, MAX_DEPTH);
    expect(r.kind).toBe('number');
    expect(r.value).toBe(42);
  });

  test('depth=12 的 null → 正常叶子(不截断)', () => {
    const r = buildTree(null, null, MAX_DEPTH);
    expect(r.kind).toBe('null');
  });

  test('13 层嵌套对象 → 第 12 层截断', () => {
    const r = buildTree(deepNested(13));
    let node: any = r;
    for (let i = 0; i < 12; i++) {
      expect(node.kind).toBe('object');
      expect(node.size).toBe(1);
      node = node.children[0]; // 走 'a' 子节点
    }
    // depth=12 → 截断
    expect(node.kind).toBe('string');
    expect(node.value).toBe('[深度截断]');
    expect(node.depth).toBe(MAX_DEPTH);
    expect(node.children).toBeNull();
  });

  test('12 层嵌套对象 → 不截断(恰好 MAX_DEPTH-1 层容器)', () => {
    // deepNested(12) → 12 层对象,最内层是 'leaf' 字符串
    const r = buildTree(deepNested(12));
    let node: any = r;
    for (let i = 0; i < 12; i++) {
      expect(node.kind).toBe('object');
      node = node.children[0];
    }
    // 到达 'leaf'
    expect(node.kind).toBe('string');
    expect(node.value).toBe('leaf');
  });
});

// ============ buildTree — 子节点数截断 ============

describe('buildTree — 子节点数截断(MAX_CHILDREN=1000)', () => {
  test('1001 元素数组 → 截断为 1000 + 占位符', () => {
    const big = Array.from({ length: 1001 }, (_, i) => i);
    const r = buildTree(big);
    expect(r.kind).toBe('array');
    expect(r.size).toBe(1000); // size = 截断后的 entries.length
    expect(r.children.length).toBe(1001); // 1000 entries + 1 占位符

    // 占位符在末尾
    const placeholder = r.children[1000];
    expect(placeholder.kind).toBe('string');
    expect(placeholder.key).toBe('…');
    expect(placeholder.value).toBe('[剩余 1 项已截断]');
    expect(placeholder.children).toBeNull();
    expect(placeholder.size).toBe(0);
  });

  test('1005 元素数组 → overflow=5', () => {
    const big = Array.from({ length: 1005 }, (_, i) => i);
    const r = buildTree(big);
    const placeholder = r.children[1000];
    expect(placeholder.value).toBe('[剩余 5 项已截断]');
  });

  test('恰好 1000 元素 → 不截断', () => {
    const big = Array.from({ length: 1000 }, (_, i) => i);
    const r = buildTree(big);
    expect(r.size).toBe(1000);
    expect(r.children.length).toBe(1000);
    // 无占位符
    expect(r.children.some((c: any) => c.key === '…')).toBe(false);
  });

  test('1001 字段对象 → 截断', () => {
    const entries = Array.from({ length: 1001 }, (_, i) => [`k${i}`, i]);
    const big = Object.fromEntries(entries);
    const r = buildTree(big);
    expect(r.kind).toBe('object');
    expect(r.size).toBe(1000);
    expect(r.children.length).toBe(1001);
    const placeholder = r.children[1000];
    expect(placeholder.value).toBe('[剩余 1 项已截断]');
  });

  test('截断后前 1000 个子节点正常', () => {
    const big = Array.from({ length: 1005 }, (_, i) => i * 2);
    const r = buildTree(big);
    // 验证前几个和最后几个(截断前)的值
    expect(r.children[0].value).toBe(0);
    expect(r.children[1].value).toBe(2);
    expect(r.children[999].value).toBe(999 * 2);
  });
});

// ============ countNodes ============

describe('countNodes', () => {
  test('叶子节点 → 1', () => {
    expect(countNodes(buildTree(42))).toBe(1);
    expect(countNodes(buildTree('x'))).toBe(1);
    expect(countNodes(buildTree(null))).toBe(1);
    expect(countNodes(buildTree(true))).toBe(1);
  });

  test('空容器 → 1', () => {
    expect(countNodes(buildTree({}))).toBe(1);
    expect(countNodes(buildTree([]))).toBe(1);
  });

  test('单字段对象 → 2(root + 1 child)', () => {
    expect(countNodes(buildTree({ a: 1 }))).toBe(2);
  });

  test('多字段对象 → 1 + 字段数', () => {
    expect(countNodes(buildTree({ a: 1, b: 2, c: 3 }))).toBe(4);
  });

  test('嵌套对象递归计数', () => {
    // { a: { b: 1 } } → root + a + b-value = 3
    expect(countNodes(buildTree({ a: { b: 1 } }))).toBe(3);
  });

  test('数组递归计数', () => {
    // [1, 2, 3] → root + 3 elements = 4
    expect(countNodes(buildTree([1, 2, 3]))).toBe(4);
  });

  test('混合嵌套计数', () => {
    // { items: [1, 2], name: 'x' }
    // root(1) + items(1) + [1](1) + [2](1) + name(1) = 5
    expect(countNodes(buildTree({ items: [1, 2], name: 'x' }))).toBe(5);
  });

  test('深度截断时不计数未构建的节点', () => {
    // 13 层嵌套:12 个 object + 1 个截断 string = 13
    const r = buildTree(deepNested(13));
    expect(countNodes(r)).toBe(13);
  });

  test('子节点截断时含占位符', () => {
    // 1005 元素数组:root + 1000 elements + 1 placeholder = 1002
    const big = Array.from({ length: 1005 }, (_, i) => i);
    const r = buildTree(big);
    expect(countNodes(r)).toBe(1002);
  });
});

// ============ 端到端综合场景 ============

describe('buildTree — 综合场景', () => {
  test('evorule payload 风格的结构', () => {
    const payload = {
      counter: 0,
      name: 'session-A',
      active: true,
      rules: ['r1', 'r2'],
      meta: { created: '2026-07-01', tags: ['a', 'b'] }
    };
    const r = buildTree(payload);

    expect(r.kind).toBe('object');
    expect(r.size).toBe(5);
    expect(r.depth).toBe(0);

    // 验证各字段类型
    expect(findChild(r, 'counter').kind).toBe('number');
    expect(findChild(r, 'name').kind).toBe('string');
    expect(findChild(r, 'active').kind).toBe('boolean');
    expect(findChild(r, 'rules').kind).toBe('array');
    expect(findChild(r, 'meta').kind).toBe('object');

    // 嵌套:meta.tags 是数组
    const meta = findChild(r, 'meta');
    const tags = findChild(meta, 'tags');
    expect(tags.kind).toBe('array');
    expect(tags.size).toBe(2);
    expect(tags.children[0].value).toBe('a');

    // countNodes: root + 5 fields + rules(2) + meta(2) + tags(2) = 12
    expect(countNodes(r)).toBe(12);
  });

  test('What-If fork state 风格的结构', () => {
    const forkState = {
      version: 5,
      payload: { x: 1, y: { z: 99 } },
      queue: []
    };
    const r = buildTree(forkState);
    expect(r.kind).toBe('object');
    expect(r.size).toBe(3);

    const payload = findChild(r, 'payload');
    expect(payload.kind).toBe('object');
    const y = findChild(payload, 'y');
    expect(y.kind).toBe('object');
    const z = findChild(y, 'z');
    expect(z.value).toBe(99);

    const queue = findChild(r, 'queue');
    expect(queue.kind).toBe('array');
    expect(queue.size).toBe(0);
  });

  test('大 payload 性能:1000 元素不截断,构建正常', () => {
    const big = Array.from({ length: 1000 }, (_, i) => ({ id: i, name: `item${i}` }));
    const r = buildTree(big);
    expect(r.kind).toBe('array');
    expect(r.size).toBe(1000);
    expect(r.children.length).toBe(1000);
    // 每个元素是对象,有 2 个字段
    expect(r.children[0].kind).toBe('object');
    expect(r.children[0].size).toBe(2);
    // 不截断:无占位符
    expect(r.children.some((c: any) => c.key === '…')).toBe(false);
  });
});
