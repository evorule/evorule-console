export namespace TimelineView {
    /** SESSION_SELECT → 加载 facts */
    function onSessionChange(id: any): Promise<void>;
    /** 切到本 tab 时,若未加载则触发加载 */
    function onShow(): void;
    function loadFacts(id: any): Promise<void>;
    function render(): void;
}
