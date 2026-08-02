export namespace store {
    function getState(): {
        views: {
            timeline: {
                facts: never[];
                maxVersion: number;
                loading: boolean;
                playing: boolean;
                playSpeed: number;
            };
            state: {
                version: null;
                payload: null;
            };
            causal: {
                focusFactId: null;
                chain: never[];
            };
            diff: {
                vA: null;
                vB: null;
                mode: string;
            };
            whatif: {
                status: string;
                forkSessionId: null;
                parentVersion: null;
                commands: never[];
                comparison: null;
            };
        };
        apiUrl: string;
        sessions: never[];
        currentSessionId: null;
        selectedVersion: number;
        searchTerm: string;
        auditBadge: {
            verified: null;
            factCount: null;
        };
    };
    function subscribe(fn: any): () => boolean;
    function dispatch(updater: any): void;
    /** 更新某个视图的局部状态 */
    function setView(viewName: any, partial: any): void;
    function reset(): void;
}
