import type { AssistantProvider } from './types';
/**
 * 在根组件(+layout.svelte)调用,注入 assistant provider 实例。
 *
 * evorule-console 自身不调用此函数(或传 null),LLM 按钮不渲染。
 * 大众版调用 provideAssistant(cloudLlmAssistant) 注入实现。
 *
 * @param provider LLM 辅助实例,传 null 或不传 = 不注入(默认)
 */
export declare function provideAssistant(provider?: AssistantProvider | null): AssistantProvider | null;
/**
 * 在子组件调用,取出注入的 assistant provider。
 *
 * @returns provider 实例;未注入或 evorule-console 自身运行时返回 null
 *
 * 视图用法:
 * ```svelte
 * const assistant = useAssistantOrNull();
 * {#if assistant}
 *   <button onclick={() => assistant.generateRuleDraft(...)}>AI 辅助创建</button>
 * {/if}
 * ```
 */
export declare function useAssistantOrNull(): AssistantProvider | null;
