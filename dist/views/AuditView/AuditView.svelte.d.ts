interface Props {
    /** 是否展开 (默认 true, 兼容 audit tab 独立渲染) */
    open?: boolean;
    /** 模态展示的 fact id (null = 整链摘要) */
    factId?: number | null;
    /** 关闭回调 (存在时 = overlay 模态; 缺失时 = 内联全页) */
    onclose?: () => void;
}
declare const AuditView: import("svelte").Component<Props, {}, "">;
type AuditView = ReturnType<typeof AuditView>;
export default AuditView;
