/**
 * 计算两个 JSON 值的深度 diff
 * @param {*} a - 旧值(可能为 undefined 表示"新增")
 * @param {*} b - 新值(可能为 undefined 表示"删除")
 * @param {string|number|null} key
 * @returns {DiffNode}
 */
export function deepDiff(a: any, b: any, key?: string | number | null): DiffNode;
/**
 * 统计树中发生变更的叶子节点数(用于容器摘要 "N changes")
 * 整体 added/removed 的容器按叶子数计(更直观)
 */
export function countChanges(node: any): any;
