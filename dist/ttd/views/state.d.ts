export namespace StateView {
    /** SESSION_SELECT → 重置 + 加载 v0 */
    function onSessionChange(id: any): Promise<void>;
    /** 切到本 tab 时,若未加载则触发加载 */
    function onShow(): void;
    function loadVersion(id: any, version: any): Promise<void>;
    function render(): void;
}
