export namespace WhatIfView {
    /** SESSION_SELECT → 重置 */
    function onSessionChange(id: any): void;
    function onShow(): void;
    /** 步骤 1:Fork */
    function runFork(parentVersion: any): Promise<void>;
    /** 步骤 2-3:提交命令 + 轮询 + 对比 */
    function runCommands(commandsJson: any): Promise<void>;
    function reset(): void;
    function render(): void;
    function renderStep1(panel: any, state: any, w: any): void;
    function renderStep2(panel: any, state: any, w: any): void;
    function renderProgress(panel: any, w: any): void;
    function renderResult(panel: any, state: any, w: any): void;
    function renderError(panel: any, w: any): void;
}
