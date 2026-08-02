/**
 * 渲染单条 fact 卡片
 * @param {Object} fact - fact 对象
 * @param {{selected?: boolean, onSelect?: (fact: Object) => void}} opts
 * @returns {HTMLElement}
 */
export function renderFactCard(fact: Object, { selected, onSelect }?: {
    selected?: boolean;
    onSelect?: (fact: Object) => void;
}): HTMLElement;
