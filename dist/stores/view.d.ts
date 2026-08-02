/** 5 个视图的 id(与导航 tab 一一对应) */
export type ViewId = 'rules' | 'execution' | 'state' | 'audit' | 'timetravel';
/** 视图元数据:id + 导航显示 + 对应的 evorule 本质属性 */
export interface ViewMeta {
    id: ViewId;
    /** 导航 tab 主标签 */
    label: string;
    /** 该视图展现的 evorule 本质(导航副标题/tooltip) */
    essence: string;
    /** 图标(emoji,无图标库依赖) */
    icon: string;
}
/**
 * 5 视图清单 — 顺序即导航排列顺序。
 * 每个视图至少对应 1 个 evorule 本质属性(SPEC §2 验收矩阵)。
 */
export declare const VIEW_LIST: ViewMeta[];
/** 按 id 查视图元数据(找不到返回 undefined) */
export declare function getViewMeta(id: ViewId): ViewMeta;
/**
 * 当前活动视图 store。默认 'rules'(规则库作为首屏入口,体现"规则即数据")。
 *
 * 不在模块顶层读 localStorage(避免 SSR/prerender 与客户端 hydration 不一致),
 * 由 +layout.svelte onMount 调用 restoreView() 恢复。
 */
export declare const currentView: import("svelte/store").Writable<ViewId>;
/** 切换视图 + 持久化 */
export declare function setView(view: ViewId): void;
/**
 * 从 localStorage 恢复上次视图(在 +layout.svelte onMount 中调用)。
 * 非法值(旧版本残留/手改)回退到默认视图。
 */
export declare function restoreView(): void;
