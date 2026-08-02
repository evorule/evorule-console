export namespace SessionList {
    /** 刷新会话列表 */
    function refresh(): Promise<void>;
    /** 选择会话 */
    function select(id: any): void;
}
