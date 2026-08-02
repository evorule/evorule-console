export namespace api {
    function listSessions(): Promise<any>;
    function createSession(): Promise<any>;
    function closeSession(id: any): Promise<any>;
    function rewind(id: any, version: any): Promise<any>;
    function diff(id: any, a: any, b: any): Promise<any>;
    function audit(id: any): Promise<any>;
    function auditVerify(id: any): Promise<any>;
    function replay(id: any, from?: number, to?: null): Promise<any>;
    function history(id: any): Promise<any>;
    function state(id: any): Promise<any>;
    function causal(id: any, factId: any): Promise<any>;
    function fork(parentId: any, version: any): Promise<any>;
    function command(id: any, instruction: any): Promise<any>;
    function facts(id: any, prefix: any): Promise<any>;
}
