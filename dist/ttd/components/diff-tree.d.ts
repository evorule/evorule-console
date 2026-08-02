/**
 * 渲染 diff 树
 * @param {DiffNode} rootNode - deepDiff 返回的根节点
 * @param {number} expandDepth - 默认展开深度
 * @returns {HTMLElement}
 */
export function renderDiffTree(rootNode: DiffNode, expandDepth?: number): HTMLElement;
