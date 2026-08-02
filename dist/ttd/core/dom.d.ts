/** HTML 转义 */
export function esc(s: any): string;
/** 防抖 */
export function debounce(fn: any, ms?: number): (...args: any[]) => void;
/**
 * hyperscript: 创建 DOM 元素
 * h('div', { class: 'foo', onclick: fn }, [child1, 'text', child2])
 */
export function h(tag: any, props?: {}, children?: any[]): any;
/** 清空元素 */
export function clear(el: any): any;
/** 格式化 JSON */
export function fmtJson(obj: any): string;
/** 截断字符串 */
export function truncate(s: any, n?: number): any;
/** 短显示值 */
export function shortVal(v: any, n?: number): string;
