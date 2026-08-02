/**
 * 将任意 JSON 值转为树结构
 * @param {*} value
 * @param {string|number|null} key - 字段名(递归用)
 * @param {number} depth - 当前深度(递归用)
 * @returns {TreeNode}
 */
export function buildTree(value: any, key?: string | number | null, depth?: number): TreeNode;
/** 统计节点总数(性能预算用) */
export function countNodes(node: any): any;
