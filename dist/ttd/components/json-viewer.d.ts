/**
 * 渲染 JSON 值为可折叠树
 * @param {*} value - 任意 JSON 值
 * @param {{expandDepth?: number}} opts
 * @returns {HTMLElement}
 */
export function renderJson(value: any, opts?: {
    expandDepth?: number;
}): HTMLElement;
