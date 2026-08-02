import type { ExecutionBackend } from '../backend/types';
/**
 * 把 console 的 ExecutionBackend 注入到 ttd api 模块。
 *
 * 调用时机:TimeTravel.svelte onMount 后,backend 实例已就绪时。
 * 调用一次即可,后续 ttd 各 view 调 api.xxx() 会走 console 实现。
 *
 * @param backend  console 的执行后端实例(HttpBackend 或 EmbeddedBackend)
 */
export declare function injectBackend(backend: ExecutionBackend): void;
/**
 * 把 console 当前选中的 session 同步给 ttd store + emit SESSION_SELECT。
 *
 * 调用时机:console session store 的 currentSessionId 变化时,
 * TimeTravel.svelte 监听变化后调用本函数。
 *
 * @param sessionId  console 当前 session id(null 表示无 session)
 */
export declare function syncSessionToTtd(sessionId: number | null): Promise<void>;
