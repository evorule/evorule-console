/** 注册视图 */
export function registerView(name: any, view: any): void;
/**
 * evorule-console 适配入口。
 *
 * @param {{ skipAutoSelect?: boolean, skipApiUrl?: boolean, skipKeyboard?: boolean }} opts
 *   - skipAutoSelect: evorule-console 自己管理 session 选择(走 ExecutionPad 创建/切换),不让 ttd 自动选第一个
 *   - skipApiUrl: evorule-console 通过 console-adapter 注入 backend,ttd 不需要 apiUrl 输入框
 *   - skipKeyboard: 若 console 已有全局快捷键处理,避免重复绑定
 * @returns {Promise<void>}
 */
export function initTtd(opts?: {
    skipAutoSelect?: boolean;
    skipApiUrl?: boolean;
    skipKeyboard?: boolean;
}): Promise<void>;
/**
 * 清理 ttd(组件卸载时调用)。
 * 当前实现只重置 store;eventbus listeners 是 module-level 持久化的,
 * 多次挂载/卸载不会泄漏(重复 on 同一 handler 会被 Set 去重?需检查)。
 * TODO(P6):完整 listeners 清理需要 views 暴露 cleanup 接口。
 */
export function cleanupTtd(): void;
