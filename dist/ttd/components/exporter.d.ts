export namespace Exporter {
    /** 导出当前 session 的完整 fact log(JSONL) */
    function exportFacts(sessionId: any): Promise<void>;
    /** 导出当前 session 的审计链(JSONL) */
    function exportAudit(sessionId: any): Promise<void>;
}
