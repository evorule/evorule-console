export namespace DiffView {
    /** SESSION_SELECT → 重置(不自动跑,避免 timeline 还没加载完) */
    function onSessionChange(id: any): void;
    /** 切到本 tab:首次打开时设默认 vA/vB 并自动跑 */
    function onShow(): void;
    function run(): Promise<void>;
    function renderControls(state: any): any;
    function render(): void;
}
