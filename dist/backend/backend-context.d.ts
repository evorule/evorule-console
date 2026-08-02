import type { ExecutionBackend } from './types';
/**
 * 在根组件(+layout.svelte)调用一次,注入 backend 实例。
 *
 * 默认用 HttpBackend(开发期 / 大众版)。
 * 高级版替换为 EmbeddedBackend 时,只需在 root 处显式传 backend 参数。
 *
 * @param backend  可选,自定义 backend(测试或高级版用)
 */
export declare function provideBackend(backend?: ExecutionBackend): ExecutionBackend;
/**
 * 在子组件调用,取出注入的 backend 实例。
 *
 * @throws 若未在父组件调用过 provideBackend,抛出明确错误(便于排查)
 */
export declare function useBackend(): ExecutionBackend;
/**
 * 非抛错版,用于"可能未注入"的场景(如临时组件、e2e 测试页)。
 */
export declare function useBackendOrNull(): ExecutionBackend | null;
export { HttpBackend } from './http-backend';
export type { ExecutionBackend } from './types';
