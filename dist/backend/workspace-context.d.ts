import type { WorkspaceBackend } from './workspace-types';
/**
 * 在根组件(+layout.svelte)调用一次,注入 workspace backend 实例。
 *
 * 默认用 HttpWorkspaceBackend(开发期 / 大众版,loopback 免认证)。
 * 高级版替换为 EmbeddedWorkspaceBackend 时,显式传 backend 参数。
 *
 * @param backend  可选,自定义 backend(测试或高级版用)
 */
export declare function provideWorkspaceBackend(backend?: WorkspaceBackend): WorkspaceBackend;
/**
 * 在子组件调用,取出注入的 workspace backend 实例。
 *
 * @throws 若未在父组件调用过 provideWorkspaceBackend,抛出明确错误(便于排查)
 */
export declare function useWorkspaceBackend(): WorkspaceBackend;
/**
 * 非抛错版,用于"可能未注入"的场景(如临时组件、e2e 测试页)。
 */
export declare function useWorkspaceBackendOrNull(): WorkspaceBackend | null;
export { HttpWorkspaceBackend } from './http-workspace-backend';
export type { WorkspaceBackend } from './workspace-types';
