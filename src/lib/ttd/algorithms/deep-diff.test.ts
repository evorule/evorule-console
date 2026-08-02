// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 EvoRule Project
// deep-diff.js 纯函数单元测试(无 DOM 依赖)
//
// 适配说明(evorule-console 内嵌副本):
//   - 原测试在 time-travel-debugger/tests/unit/deep-diff.test.mjs 用 node:test
//   - evorule-console 统一用 vitest,本文件为 vitest 版本
//   - 测试逻辑与原版一致,仅替换 assert API:assert.equal → expect().toBe 等
//
// 运行: npx vitest run src/lib/ttd/algorithms/deep-diff.test.ts

import { describe, test, expect } from 'vitest';
import { deepDiff, countChanges } from './deep-diff.js';

// ============ 辅助 ============

/** 在 DiffNode 的 children 中按 key 查找子节点 */
function findChild(node: any, key: string | number): any {
  return (node.children || []).find((c: any) => c.key === key);
}

/** 断言叶子节点结构 */
function assertLeaf(node: any, status: string, key: string | number | null): void {
  expect(node.kind).toBe('primitive');
  expect(node.status).toBe(status);
  expect(node.key).toBe(key);
  expect(node.children).toBeNull();
}

// ============ deepDiff — 原始类型 ============

describe('deepDiff — 原始类型', () => {
  test('相等数字 → unchanged', () => {
    const r = deepDiff(1, 1);
    assertLeaf(r, 'unchanged', null);
    expect(r.oldVal).toBe(1);
    expect(r.newVal).toBe(1);
  });

  test('不同数字 → changed', () => {
    const r = deepDiff(1, 2);
    assertLeaf(r, 'changed', null);
    expect(r.oldVal).toBe(1);
    expect(r.newVal).toBe(2);
  });

  test('相等字符串 → unchanged', () => {
    const r = deepDiff('abc', 'abc');
    assertLeaf(r, 'unchanged', null);
  });

  test('不同字符串 → changed', () => {
    const r = deepDiff('abc', 'abd');
    assertLeaf(r, 'changed', null);
  });

  test('相等布尔 → unchanged', () => {
    expect(deepDiff(true, true).status).toBe('unchanged');
    expect(deepDiff(false, false).status).toBe('unchanged');
  });

  test('不同布尔 → changed', () => {
    expect(deepDiff(true, false).status).toBe('changed');
  });

  test('null === null → unchanged(引用相等)', () => {
    const r = deepDiff(null, null);
    assertLeaf(r, 'unchanged', null);
    expect(r.oldVal).toBeNull();
    expect(r.newVal).toBeNull();
  });

  test('null vs 非 null → changed', () => {
    const r = deepDiff(null, 5);
    assertLeaf(r, 'changed', null);
    expect(r.oldVal).toBeNull();
    expect(r.newVal).toBe(5);
  });

  test('非 null vs null → changed', () => {
    const r = deepDiff(5, null);
    assertLeaf(r, 'changed', null);
    expect(r.oldVal).toBe(5);
    expect(r.newVal).toBeNull();
  });

  test('类型不同(number vs string)→ changed(整体替换)', () => {
    const r = deepDiff(1, '1');
    assertLeaf(r, 'changed', null);
    expect(r.oldVal).toBe(1);
    expect(r.newVal).toBe('1');
  });

  test('类型不同(boolean vs number)→ changed', () => {
    const r = deepDiff(true, 1);
    assertLeaf(r, 'changed', null);
  });

  test('带 key 参数时 key 传递到叶子', () => {
    const r = deepDiff(1, 2, 'counter');
    expect(r.key).toBe('counter');
  });
});

// ============ deepDiff — undefined 处理 ============

describe('deepDiff — undefined 处理', () => {
  test('a=undefined + b=原始值 → added', () => {
    const r = deepDiff(undefined, 42, 'x');
    assertLeaf(r, 'added', 'x');
    expect(r.oldVal).toBeUndefined();
    expect(r.newVal).toBe(42);
  });

  test('a=原始值 + b=undefined → removed', () => {
    const r = deepDiff(42, undefined, 'x');
    assertLeaf(r, 'removed', 'x');
    expect(r.oldVal).toBe(42);
    expect(r.newVal).toBeUndefined();
  });

  test('a=undefined + b=对象 → added(容器,保留结构)', () => {
    const r = deepDiff(undefined, { a: 1, b: 2 }, 'x');
    expect(r.kind).toBe('object');
    expect(r.status).toBe('added');
    expect(r.key).toBe('x');
    expect(r.oldVal).toBeUndefined();
    expect(r.newVal).toEqual({ a: 1, b: 2 });
    // 子节点全部继承 added
    expect(r.children.length).toBe(2);
    r.children.forEach((c: any) => expect(c.status).toBe('added'));
  });

  test('a=数组 + b=undefined → removed(容器,保留结构)', () => {
    const r = deepDiff([1, 2], undefined, 'x');
    expect(r.kind).toBe('array');
    expect(r.status).toBe('removed');
    expect(r.newVal).toBeUndefined();
    expect(r.oldVal).toEqual([1, 2]);
    expect(r.children.length).toBe(2);
    r.children.forEach((c: any) => expect(c.status).toBe('removed'));
  });

  test('容器整体 added 时子节点递归保留嵌套结构', () => {
    const r = deepDiff(undefined, { outer: { inner: 1 } }, 'x');
    expect(r.status).toBe('added');
    const outer = findChild(r, 'outer');
    expect(outer.status).toBe('added');
    expect(outer.kind).toBe('object');
    const inner = findChild(outer, 'inner');
    expect(inner.status).toBe('added');
    expect(inner.newVal).toBe(1);
  });
});

// ============ deepDiff — 对象 ============

describe('deepDiff — 对象', () => {
  test('空对象 → 容器 changed,无子节点', () => {
    const r = deepDiff({}, {});
    expect(r.kind).toBe('object');
    expect(r.status).toBe('changed'); // 容器始终 changed(不同引用)
    expect(r.children.length).toBe(0);
  });

  test('深相等对象 → 容器 changed,子节点全 unchanged', () => {
    const r = deepDiff({ a: 1 }, { a: 1 });
    expect(r.kind).toBe('object');
    expect(r.status).toBe('changed'); // 容器 changed(引用不同)
    const a = findChild(r, 'a');
    expect(a.status).toBe('unchanged');
    expect(a.oldVal).toBe(1);
    expect(a.newVal).toBe(1);
  });

  test('新增字段 → child added', () => {
    const r = deepDiff({ a: 1 }, { a: 1, b: 2 });
    const b = findChild(r, 'b');
    expect(b.status).toBe('added');
    expect(b.newVal).toBe(2);
    expect(b.oldVal).toBeUndefined();
  });

  test('删除字段 → child removed', () => {
    const r = deepDiff({ a: 1, b: 2 }, { a: 1 });
    const b = findChild(r, 'b');
    expect(b.status).toBe('removed');
    expect(b.oldVal).toBe(2);
    expect(b.newVal).toBeUndefined();
  });

  test('值变化 → child changed', () => {
    const r = deepDiff({ a: 1 }, { a: 2 });
    const a = findChild(r, 'a');
    expect(a.status).toBe('changed');
    expect(a.oldVal).toBe(1);
    expect(a.newVal).toBe(2);
  });

  test('嵌套对象递归 diff', () => {
    const r = deepDiff(
      { outer: { a: 1, b: 2 } },
      { outer: { a: 1, b: 99 } }
    );
    const outer = findChild(r, 'outer');
    expect(outer.kind).toBe('object');
    const a = findChild(outer, 'a');
    expect(a.status).toBe('unchanged');
    const b = findChild(outer, 'b');
    expect(b.status).toBe('changed');
    expect(b.oldVal).toBe(2);
    expect(b.newVal).toBe(99);
  });

  test('子键按字母顺序排序', () => {
    const r = deepDiff(
      { z: 1, a: 2, m: 3 },
      { z: 1, a: 2, m: 3 }
    );
    const keys = r.children.map((c: any) => c.key);
    expect(keys).toEqual(['a', 'm', 'z']);
  });

  test('字段类型变化(object → number)→ child changed', () => {
    const r = deepDiff({ a: { x: 1 } }, { a: 42 });
    const a = findChild(r, 'a');
    expect(a.status).toBe('changed');
    expect(a.kind).toBe('primitive');
    expect(a.oldVal).toEqual({ x: 1 });
    expect(a.newVal).toBe(42);
  });
});

// ============ deepDiff — 数组 ============

describe('deepDiff — 数组', () => {
  test('空数组 → 容器 changed,无子节点', () => {
    const r = deepDiff([], []);
    expect(r.kind).toBe('array');
    expect(r.status).toBe('changed');
    expect(r.children.length).toBe(0);
  });

  test('深相等数组 → 容器 changed,子节点全 unchanged', () => {
    const r = deepDiff([1, 2, 3], [1, 2, 3]);
    expect(r.kind).toBe('array');
    expect(r.status).toBe('changed');
    r.children.forEach((c: any, i: number) => {
      expect(c.key).toBe(i);
      expect(c.status).toBe('unchanged');
    });
  });

  test('元素变化 → child changed(key 为索引)', () => {
    const r = deepDiff([1, 2, 3], [1, 99, 3]);
    expect(r.children[1].status).toBe('changed');
    expect(r.children[1].key).toBe(1);
    expect(r.children[1].oldVal).toBe(2);
    expect(r.children[1].newVal).toBe(99);
  });

  test('尾部新增元素 → 末尾 child added', () => {
    const r = deepDiff([1, 2], [1, 2, 3]);
    expect(r.children.length).toBe(3);
    expect(r.children[2].status).toBe('added');
    expect(r.children[2].key).toBe(2);
    expect(r.children[2].newVal).toBe(3);
    expect(r.children[2].oldVal).toBeUndefined();
  });

  test('尾部删除元素 → 末尾 child removed', () => {
    const r = deepDiff([1, 2, 3], [1, 2]);
    expect(r.children.length).toBe(3);
    expect(r.children[2].status).toBe('removed');
    expect(r.children[2].oldVal).toBe(3);
    expect(r.children[2].newVal).toBeUndefined();
  });

  test('元素级对齐(无 LCS):中间插入显示为全量替换', () => {
    // [1,3] vs [1,2,3] — 无 Myers LCS,按索引对齐
    // index 1: 3 vs 2 → changed
    // index 2: undefined vs 3 → added
    const r = deepDiff([1, 3], [1, 2, 3]);
    expect(r.children.length).toBe(3);
    expect(r.children[0].status).toBe('unchanged'); // 1 vs 1
    expect(r.children[1].status).toBe('changed');   // 3 vs 2
    expect(r.children[2].status).toBe('added');     // undefined vs 3
  });

  test('嵌套数组递归 diff', () => {
    const r = deepDiff(
      [[1, 2], [3, 4]],
      [[1, 2], [3, 99]]
    );
    const child1 = r.children[1];
    expect(child1.kind).toBe('array');
    expect(child1.children[1].status).toBe('changed');
    expect(child1.children[1].oldVal).toBe(4);
    expect(child1.children[1].newVal).toBe(99);
  });

  test('数组元素为对象 → 递归 diff', () => {
    const r = deepDiff(
      [{ x: 1 }, { y: 2 }],
      [{ x: 1 }, { y: 99 }]
    );
    const elem1 = r.children[1];
    expect(elem1.kind).toBe('object');
    const y = findChild(elem1, 'y');
    expect(y.status).toBe('changed');
    expect(y.oldVal).toBe(2);
    expect(y.newVal).toBe(99);
  });
});

// ============ countChanges ============

describe('countChanges', () => {
  test('null → 0', () => {
    expect(countChanges(null)).toBe(0);
  });

  test('undefined → 0', () => {
    expect(countChanges(undefined)).toBe(0);
  });

  test('unchanged 叶子 → 0', () => {
    expect(countChanges(deepDiff(1, 1))).toBe(0);
  });

  test('changed 叶子 → 1', () => {
    expect(countChanges(deepDiff(1, 2))).toBe(1);
  });

  test('added 叶子 → 1', () => {
    expect(countChanges(deepDiff(undefined, 5))).toBe(1);
  });

  test('removed 叶子 → 1', () => {
    expect(countChanges(deepDiff(5, undefined))).toBe(1);
  });

  test('对象 1 个字段变化 → 1', () => {
    const r = deepDiff({ a: 1, b: 2 }, { a: 1, b: 99 });
    expect(countChanges(r)).toBe(1);
  });

  test('对象多字段变化 → N', () => {
    const r = deepDiff(
      { a: 1, b: 2, c: 3 },
      { a: 11, b: 22, c: 33 }
    );
    expect(countChanges(r)).toBe(3);
  });

  test('对象增删改混合 → 分别计数', () => {
    const r = deepDiff(
      { a: 1, b: 2, c: 3 },
      { a: 1, b: 99, d: 4 }
    );
    // b: changed(1), c: removed(1), d: added(1) = 3
    expect(countChanges(r)).toBe(3);
  });

  test('容器整体 added → 按叶子数计', () => {
    const r = deepDiff(undefined, { a: 1, b: 2, c: 3 });
    expect(countChanges(r)).toBe(3);
  });

  test('容器整体 removed → 按叶子数计', () => {
    const r = deepDiff([1, 2, 3, 4], undefined);
    expect(countChanges(r)).toBe(4);
  });

  test('深嵌套变更计数', () => {
    const r = deepDiff(
      { outer: { a: 1, b: 2, c: { x: 10, y: 20 } } },
      { outer: { a: 99, b: 2, c: { x: 10, y: 99 } } }
    );
    // a: changed, c.y: changed = 2
    expect(countChanges(r)).toBe(2);
  });

  test('深相等容器 → 0(所有叶子 unchanged)', () => {
    const r = deepDiff({ a: { b: { c: 1 } } }, { a: { b: { c: 1 } } });
    expect(countChanges(r)).toBe(0);
  });
});

// ============ 端到端综合场景 ============

describe('deepDiff — 综合场景', () => {
  test('evorule payload 风格的 diff', () => {
    const oldPayload = {
      counter: 0,
      name: 'session-A',
      rules: ['r1', 'r2'],
      meta: { created: '2026-07-01', tags: ['a', 'b'] }
    };
    const newPayload = {
      counter: 5,
      name: 'session-A',
      rules: ['r1', 'r2', 'r3'],
      meta: { created: '2026-07-01', tags: ['a', 'c'] }
    };
    const r = deepDiff(oldPayload, newPayload);
    expect(r.kind).toBe('object');

    // counter: changed
    expect(findChild(r, 'counter').status).toBe('changed');
    // name: unchanged
    expect(findChild(r, 'name').status).toBe('unchanged');
    // rules: array changed(新增 r3)
    const rules = findChild(r, 'rules');
    expect(rules.kind).toBe('array');
    expect(rules.children[2].status).toBe('added');
    // meta.tags[1]: changed (b → c)
    const meta = findChild(r, 'meta');
    const tags = findChild(meta, 'tags');
    expect(tags.children[1].status).toBe('changed');

    // countChanges: counter(1) + rules[2](1) + tags[1](1) = 3
    expect(countChanges(r)).toBe(3);
  });

  test('What-If 风格的 cross-session diff', () => {
    const parentState = { x: 1, y: 2, z: 3 };
    const forkState = { x: 1, y: 99, w: 4 };
    const r = deepDiff(parentState, forkState);
    // x: unchanged, y: changed, z: removed, w: added
    expect(findChild(r, 'x').status).toBe('unchanged');
    expect(findChild(r, 'y').status).toBe('changed');
    expect(findChild(r, 'z').status).toBe('removed');
    expect(findChild(r, 'w').status).toBe('added');
    expect(countChanges(r)).toBe(3); // y + z + w
  });
});
