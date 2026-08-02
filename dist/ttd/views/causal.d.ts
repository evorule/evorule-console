export namespace CausalView {
    /** SESSION_SELECT → 重置 */
    function onSessionChange(id: any): void;
    /** 切到本 tab:若无 focus fact,提示用户 */
    function onShow(): void;
    /** 加载指定 fact 的因果链 */
    function loadChain(factId: any): Promise<void>;
    function render(): void;
}
