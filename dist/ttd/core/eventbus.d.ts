export namespace eventbus {
    function on(event: any, handler: any): () => void;
    function off(event: any, handler: any): void;
    function emit(event: any, data: any): void;
}
export namespace EVENTS {
    let TAB_SWITCH: string;
    let FACT_SELECT: string;
    let VERSION_SELECT: string;
    let SESSION_SELECT: string;
    let API_URL_CHANGE: string;
    let STATE_UPDATE: string;
}
