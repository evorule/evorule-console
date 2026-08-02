/**
 * evorule-server HTTP API client (切片 A, 2026-08-01 Mavis)
 *
 * 用于 console 接 evorule-server 仓 (D:\evorule-server) 的 30+ 端点.
 * 切片 A 只读,不写(避免越界 evorule-server 仓).
 *
 * 默认 baseUrl 是 evorule-server 仓 default 端口 18080.
 * 浏览器 fetch 需在客户端 mount 后调用(SSR 不安全).
 */

/**
 * @typedef {Object} ReactorState
 * @property {string} [phase]      - 当前 phase: idle / awaiting_io / stable / error
 * @property {number} [causal_depth]
 * @property {number} [current_step]
 * @property {number} [pending_io_count]
 * @property {number} [structural_invariant_violations]
 */

/**
 * @typedef {Object} SessionState
 * @property {Object} [payload]
 * @property {Array<unknown>}  [queue]
 * @property {ReactorState} [reactor]
 * @property {number} [version]
 */

/**
 * @typedef {Object} SessionAudit
 * @property {Array<unknown>}  [entries]
 * @property {number} [last_audited_version]
 * @property {number} [entry_count]
 * @property {string} [last_hash]
 * @property {string} [verify_status]
 */

/**
 * @typedef {Object} SessionReplay
 * @property {Array<unknown>} [facts]
 */

const DEFAULT_BASE_URL = 'http://127.0.0.1:18080';

export class EvoruleServerClient {
	/**
	 * @param {string} [baseUrl]
	 */
	constructor(baseUrl = DEFAULT_BASE_URL) {
		this.baseUrl = baseUrl.replace(/\/$/, '');
	}

	/**
	 * GET /api/health
	 * @returns {Promise<boolean>}
	 */
	async health() {
		try {
			const r = await fetch(`${this.baseUrl}/api/health`);
			return r.ok;
		} catch {
			return false;
		}
	}

	/**
	 * GET /api/sessions
	 * @returns {Promise<number[]>} session id 列表
	 */
	async listSessions() {
		const r = await fetch(`${this.baseUrl}/api/sessions`);
		if (!r.ok) throw new Error(`listSessions failed: ${r.status}`);
		const j = await r.json();
		return Array.isArray(j.sessions) ? j.sessions : [];
	}

	/**
	 * GET /api/sessions/{id}/state
	 * @param {number|string} id
	 * @returns {Promise<SessionState>}
	 */
	async getSessionState(id) {
		const r = await fetch(`${this.baseUrl}/api/sessions/${id}/state`);
		if (!r.ok) throw new Error(`getSessionState(${id}) failed: ${r.status}`);
		return /** @type {SessionState} */ (r.json());
	}

	/**
	 * GET /api/sessions/{id}/audit
	 * @param {number|string} id
	 * @returns {Promise<SessionAudit>}
	 */
	async getSessionAudit(id) {
		const r = await fetch(`${this.baseUrl}/api/sessions/${id}/audit`);
		if (!r.ok) throw new Error(`getSessionAudit(${id}) failed: ${r.status}`);
		return /** @type {SessionAudit} */ (r.json());
	}

	/**
	 * GET /api/sessions/{id}/replay
	 * @param {number|string} id
	 * @returns {Promise<SessionReplay>}
	 */
	async getSessionReplay(id) {
		const r = await fetch(`${this.baseUrl}/api/sessions/${id}/replay`);
		if (!r.ok) throw new Error(`getSessionReplay(${id}) failed: ${r.status}`);
		const j = await r.json();
		// server 返回的可能是裸数组或 {facts: [...]}, 两种都接受
		if (Array.isArray(j)) return { facts: j };
		return /** @type {SessionReplay} */ (j);
	}
}

/**
 * 默认 client 实例 — 用 evorule-server default 18080 端口.
 * 可以根据需要 new EvoruleServerClient(otherUrl).
 */
export const evoruleClient = new EvoruleServerClient();

