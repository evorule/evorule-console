export namespace AuditBadge {
    /** 初始化:绑定点击事件 + 订阅 SESSION_SELECT */
    function init(): void;
    /** 刷新徽章(从 /audit 读取状态) */
    function refresh(): Promise<void>;
    /** 点击徽章 → 重新验证 */
    function verify(): Promise<void>;
}
