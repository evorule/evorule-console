<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (C) 2026 EvoRule Project -->
<!-- evorule-console 审计视图 — 展现 evorule "可审计 + TCB 纯净" -->
<!--
  依据: docs/SPEC.md §2.1 (可审计)
  依据: docs/IMPLEMENTATION_PLAN.md 阶段4
  职责:
    - 审计链列表(getAudit,展示 entries 每条 fact)
    - blake3 哈希验证(verifyAudit,显示 ✅/❌ + detail)
    - 因果追溯(getCausalChain,点击 fact 看因果链)
    - TCB 纯净说明:审计/哈希在核心仓(tier1)做,本视图只展示

  设计:
    - 上方摘要:fact_count / verified / last_hash
    - 左侧主体:entries 列表,每行一条 fact,点击触发因果查询
    - 右侧侧栏:点击 fact 后展示其因果链(可关闭)
    - 底部:TCB 纯净说明区(解释前端不重算哈希,只是核心仓的展示窗口)
-->

<script lang="ts">
	import {
		auditData,
		verifyResult,
		causalSelection,
		auditLoading,
		auditError,
		refreshAudit,
		verifyAuditChain,
		fetchCausalChain,
		clearCausalSelection
	} from '../../stores/audit';
	import { currentSessionId } from '../../stores/session';
	import { useBackendOrNull } from '../../backend/backend-context';
	import type { Fact } from '../../backend/types';
	import JsonTree from '../StateView/JsonTree.svelte';

	const backend = useBackendOrNull();

	/** 当前选中的 fact id(用于高亮) */
	let selectedFactId = $state<number | null>(null);

	/** 当前需要展示详情的 fact(展开 JSON) */
	let expandedFactId = $state<number | null>(null);

	/** 组件挂载 / session 切换时自动拉审计链 */
	$effect(() => {
		const sid = $currentSessionId;
		if (backend && sid !== null) {
			// 拉取审计链(getAudit 自带 verified 字段)
			refreshAudit(backend, sid);
		}
	});

	async function handleRefreshAudit() {
		if (!backend) return;
		const sid = $currentSessionId;
		if (sid === null) return;
		await refreshAudit(backend, sid);
	}

	async function handleVerify() {
		if (!backend) return;
		const sid = $currentSessionId;
		if (sid === null) return;
		await verifyAuditChain(backend, sid);
	}

	/** 点击一条 fact:
	 *  - 第一次点击:展开详情 + 拉取因果链
	 *  - 第二次点击同一 fact:收起详情 + 关闭因果
	 */
	async function handleFactClick(fact: Fact) {
		if (!backend) return;
		const sid = $currentSessionId;
		if (sid === null) return;

		if (expandedFactId === fact.id) {
			// 收起
			expandedFactId = null;
			selectedFactId = null;
			clearCausalSelection();
			return;
		}

		expandedFactId = fact.id;
		selectedFactId = fact.id;
		await fetchCausalChain(backend, sid, fact.id);
	}

	function handleCloseCausal() {
		clearCausalSelection();
		selectedFactId = null;
		expandedFactId = null;
	}

	/** 把 last_hash(可能很长)截断显示,完整值放 title */
	function truncateHash(hash: string | undefined): string {
		if (!hash) return '-';
		if (hash.length <= 16) return hash;
		return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
	}

	/** 提取 fact 的简短描述(不同 type 取不同字段) */
	function factSummary(fact: Fact): string {
		switch (fact.type) {
			case 'instruction':
				return `instruction#${fact.id}`;
			case 'fact':
				return `fact#${fact.id}`;
			case 'state':
				return `state#${fact.id}`;
			case 'transition':
				return `transition#${fact.id}`;
			default:
				return `${fact.type}#${fact.id}`;
		}
	}

	/** 把 entries(unknown[]) 当作 Fact[] 处理(契约里 entries 是 unknown[],
	 *  但实际 evorule-server 返回的都是带 type/id 的对象) */
	function asFacts(entries: unknown[]): Fact[] {
		return entries.filter((e): e is Fact => {
			if (!e || typeof e !== 'object') return false;
			const f = e as Record<string, unknown>;
			return typeof f.type === 'string' && typeof f.id === 'number';
		});
	}
</script>

<div class="audit-view">
	<header class="view-header">
		<div class="title-group">
			<h1>审计视图</h1>
			<span class="subtitle">可审计 + TCB 纯净 — blake3 哈希链由核心仓验证</span>
		</div>
		<div class="actions">
			<button class="btn" onclick={handleRefreshAudit} disabled={!backend || $auditLoading || $currentSessionId === null}>
				{$auditLoading ? '加载中...' : '刷新审计链'}
			</button>
			<button class="btn btn-primary" onclick={handleVerify} disabled={!backend || $auditLoading || $currentSessionId === null}>
				验证哈希链
			</button>
		</div>
	</header>

	{#if !backend}
		<div class="empty-state">
			<span class="empty-icon">🔌</span>
			<p>backend 未注入</p>
			<p class="empty-hint">开发期需要 evorule-server 跑在 127.0.0.1:18080</p>
		</div>
	{:else if $currentSessionId === null}
		<div class="empty-state">
			<span class="empty-icon">📭</span>
			<p>无当前 session</p>
			<p class="empty-hint">先到执行台创建 session</p>
		</div>
	{:else if $auditError}
		<div class="error-banner" role="alert">
			<span>⚠</span>
			<span>{$auditError}</span>
		</div>
		<div class="empty-state">
			<span class="empty-icon">❗</span>
			<p>点击"刷新审计链"重试</p>
		</div>
	{:else if !$auditData}
		<div class="empty-state">
			<span class="empty-icon">⏳</span>
			<p>{$auditLoading ? '加载中...' : '无审计数据,点击"刷新审计链"'}</p>
		</div>
	{:else}
		{@const audit = $auditData}
		{@const facts = asFacts(audit.entries)}

		<section class="audit-summary">
			<div class="summary-item">
				<span class="summary-label">session</span>
				<span class="summary-value mono">{$currentSessionId}</span>
			</div>
			<div class="summary-item">
				<span class="summary-label">fact_count</span>
				<span class="summary-value mono">{audit.fact_count}</span>
			</div>
			<div class="summary-item">
				<span class="summary-label">verified</span>
				<span
					class="verify-badge"
					class:verified={audit.verified}
					class:failed={!audit.verified}
				>
					{audit.verified ? '✅ 已验证' : '❌ 未验证'}
				</span>
			</div>
			<div class="summary-item summary-hash">
				<span class="summary-label">last_hash</span>
				<span class="summary-value mono hash" title={audit.last_hash ?? ''}>
					{truncateHash(audit.last_hash)}
				</span>
			</div>
		</section>

		{#if $verifyResult}
			<section class="verify-detail" class:ok={$verifyResult.verified} class:bad={!$verifyResult.verified}>
				<header>
					<span>{'verifyAudit 结果'}</span>
					<span class="verify-result">
						{$verifyResult.verified ? '✅ 哈希链完整' : '❌ 哈希链断裂'}
					</span>
				</header>
				{#if $verifyResult.detail}
					<pre class="verify-detail-text">{$verifyResult.detail}</pre>
				{/if}
			</section>
		{/if}

		<div class="audit-body">
			<section class="entries-panel">
				<header class="panel-header">
					<h2>审计链 ({facts.length} 条 fact)</h2>
					<span class="panel-hint">点击条目查看因果链</span>
				</header>

				{#if facts.length === 0}
					<div class="empty-mini">审计链为空(提交命令后此处理论会有 fact)</div>
				{:else}
					<ul class="fact-list">
						{#each facts as fact (fact.id)}
							<li>
								<button
									class="fact-item"
									class:selected={selectedFactId === fact.id}
									onclick={() => handleFactClick(fact)}
								>
									<div class="fact-row">
										<span class="fact-id mono">#{fact.id}</span>
										<span class="fact-type">{fact.type}</span>
										<span class="fact-summary">{factSummary(fact)}</span>
										{#if expandedFactId === fact.id}
											<span class="fact-arrow">▾</span>
										{:else}
											<span class="fact-arrow">▸</span>
										{/if}
									</div>
								</button>
								{#if expandedFactId === fact.id}
									<div class="fact-detail">
										<div class="detail-label">fact JSON</div>
										<div class="detail-tree">
											<JsonTree data={fact} rootLabel="fact" />
										</div>
									</div>
								{/if}
							</li>
						{/each}
					</ul>
				{/if}
			</section>

			<aside class="causal-panel" class:visible={$causalSelection}>
				{#if $causalSelection}
					<header class="panel-header">
						<h2>因果链 (fact #{$causalSelection.factId})</h2>
						<button
							class="close-btn"
							onclick={handleCloseCausal}
							aria-label="关闭因果"
						>✕</button>
					</header>
					<p class="panel-hint">
						共 {$causalSelection.chain.length} 条前因(从根到本 fact 的因果链)
					</p>
					{#if $causalSelection.chain.length === 0}
						<div class="empty-mini">无前因(可能是根 fact)</div>
					{:else}
						<ol class="causal-list">
							{#each $causalSelection.chain as cf (cf.id)}
								<li class="causal-item">
									<span class="fact-id mono">#{cf.id}</span>
									<span class="fact-type">{cf.type}</span>
									<span class="fact-summary">{factSummary(cf)}</span>
								</li>
							{/each}
						</ol>
					{/if}
				{:else}
					<div class="empty-mini causal-placeholder">
						<span class="empty-icon">🔍</span>
						<p>点击左侧任意 fact,查看其因果链</p>
					</div>
				{/if}
			</aside>
		</div>

		<section class="tcb-note">
			<header>
				<h2>TCB 纯净说明</h2>
			</header>
			<dl>
				<div>
					<dt>哈希计算位置</dt>
					<dd>evorule 核心 (tier1 reactor)</dd>
				</div>
				<div>
					<dt>验证执行位置</dt>
					<dd>evorule 核心 (verifyAudit 接口)</dd>
				</div>
				<div>
					<dt>前端职责</dt>
					<dd>仅展示核心仓返回的审计链 / verified 状态 / 因果链,不重算哈希,不重写审计数据</dd>
				</div>
				<div>
					<dt>对齐</dt>
					<dd>GATE_ALIGNMENT.md — L_console 不污染 TCB,审计权威在 L0 核心仓</dd>
				</div>
			</dl>
		</section>
	{/if}
</div>

<style>
	.audit-view {
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow-y: auto;
		padding: var(--spacing-lg);
	}

	.view-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--spacing-lg);
	}

	.title-group h1 {
		margin: 0;
		font-size: var(--text-xl);
		color: var(--color-gray-900);
	}

	.subtitle {
		font-size: var(--text-xs);
		color: var(--color-gray-500);
		margin-left: var(--spacing-sm);
	}

	.actions {
		display: flex;
		gap: var(--spacing-sm);
	}

	.btn {
		padding: var(--spacing-sm) var(--spacing-md);
		border: 1px solid var(--color-gray-300);
		background: white;
		color: var(--color-gray-700);
		border-radius: var(--radius-md);
		cursor: pointer;
		font-size: var(--text-sm);
	}

	.btn:hover:not(:disabled) {
		background: var(--color-gray-100);
	}

	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-primary {
		background: var(--color-primary);
		border-color: var(--color-primary);
		color: white;
	}

	.btn-primary:hover:not(:disabled) {
		background: var(--color-primary-hover);
	}

	/* === 审计摘要 === */
	.audit-summary {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
		gap: var(--spacing-md);
		padding: var(--spacing-md);
		background: white;
		border: 1px solid var(--color-gray-200);
		border-radius: var(--radius-md);
		margin-bottom: var(--spacing-md);
	}

	.summary-item {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.summary-label {
		font-size: var(--text-xs);
		color: var(--color-gray-500);
		font-weight: 600;
		text-transform: uppercase;
	}

	.summary-value {
		font-size: var(--text-base);
		color: var(--color-gray-900);
	}

	.summary-hash .hash {
		font-size: var(--text-sm);
	}

	.verify-badge {
		display: inline-block;
		padding: 2px 10px;
		border-radius: var(--radius-sm);
		font-size: var(--text-xs);
		font-weight: 600;
		width: fit-content;
	}

	.verify-badge.verified {
		background: #d1fae5;
		color: #065f46;
	}

	.verify-badge.failed {
		background: #fee2e2;
		color: #991b1b;
	}

	/* === verify 详情 === */
	.verify-detail {
		padding: var(--spacing-md);
		background: white;
		border: 1px solid var(--color-gray-200);
		border-left: 4px solid var(--color-gray-400);
		border-radius: var(--radius-md);
		margin-bottom: var(--spacing-md);
	}

	.verify-detail.ok {
		border-left-color: var(--color-success);
	}

	.verify-detail.bad {
		border-left-color: var(--color-error);
	}

	.verify-detail header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--spacing-sm);
		font-size: var(--text-sm);
		font-weight: 600;
		color: var(--color-gray-700);
	}

	.verify-result {
		font-size: var(--text-xs);
	}

	.verify-detail-text {
		margin: 0;
		padding: var(--spacing-sm);
		background: var(--color-gray-50);
		border-radius: var(--radius-sm);
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		overflow-x: auto;
		white-space: pre-wrap;
	}

	/* === 主体:entries + causal === */
	.audit-body {
		display: grid;
		grid-template-columns: 1fr 360px;
		gap: var(--spacing-md);
		margin-bottom: var(--spacing-md);
	}

	.entries-panel,
	.causal-panel {
		background: white;
		border: 1px solid var(--color-gray-200);
		border-radius: var(--radius-md);
		overflow: hidden;
		display: flex;
		flex-direction: column;
		min-height: 400px;
	}

	.causal-panel {
		opacity: 0.4;
		transition: opacity var(--transition-normal);
	}

	.causal-panel.visible {
		opacity: 1;
	}

	.panel-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--spacing-sm) var(--spacing-md);
		background: var(--color-gray-50);
		border-bottom: 1px solid var(--color-gray-200);
	}

	.panel-header h2 {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--color-gray-700);
		font-weight: 600;
	}

	.panel-hint {
		font-size: var(--text-xs);
		color: var(--color-gray-500);
		font-style: italic;
	}

	.close-btn {
		background: transparent;
		border: none;
		color: var(--color-gray-500);
		cursor: pointer;
		font-size: var(--text-sm);
		padding: 2px 6px;
		border-radius: var(--radius-sm);
	}

	.close-btn:hover {
		background: var(--color-gray-100);
	}

	/* === fact 列表 === */
	.fact-list {
		list-style: none;
		margin: 0;
		padding: var(--spacing-xs);
		overflow-y: auto;
		flex: 1;
	}

	.fact-list li {
		margin-bottom: 2px;
	}

	.fact-item {
		width: 100%;
		text-align: left;
		padding: var(--spacing-sm) var(--spacing-md);
		background: transparent;
		border: none;
		border-radius: var(--radius-sm);
		cursor: pointer;
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		color: var(--color-gray-700);
	}

	.fact-item:hover {
		background: var(--color-gray-100);
	}

	.fact-item.selected {
		background: #eef2ff;
		color: var(--color-primary);
		font-weight: 600;
	}

	.fact-row {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
	}

	.fact-id {
		font-weight: 600;
		min-width: 48px;
	}

	.fact-type {
		padding: 1px 6px;
		background: var(--color-gray-100);
		border-radius: var(--radius-sm);
		font-size: var(--text-xs);
		color: var(--color-gray-700);
	}

	.fact-item.selected .fact-type {
		background: white;
	}

	.fact-summary {
		flex: 1;
		color: var(--color-gray-600);
		font-size: var(--text-xs);
	}

	.fact-arrow {
		color: var(--color-gray-400);
	}

	.fact-detail {
		padding: var(--spacing-sm) var(--spacing-md) var(--spacing-md);
	}

	.detail-label {
		font-size: var(--text-xs);
		color: var(--color-gray-500);
		text-transform: uppercase;
		font-weight: 600;
		margin-bottom: var(--spacing-xs);
	}

	.detail-tree {
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		line-height: 1.6;
		max-height: 300px;
		overflow: auto;
		padding: var(--spacing-sm);
		background: var(--color-gray-50);
		border-radius: var(--radius-md);
	}

	/* === 因果列表 === */
	.causal-list {
		list-style: decimal;
		margin: 0;
		padding: var(--spacing-sm) var(--spacing-md) var(--spacing-sm) var(--spacing-xl);
		overflow-y: auto;
		flex: 1;
	}

	.causal-item {
		padding: var(--spacing-xs) 0;
		display: flex;
		gap: var(--spacing-sm);
		align-items: center;
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		color: var(--color-gray-700);
		border-bottom: 1px solid var(--color-gray-100);
	}

	.causal-item:last-child {
		border-bottom: none;
	}

	.causal-placeholder {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: var(--spacing-xl);
		text-align: center;
		color: var(--color-gray-500);
		height: 100%;
	}

	.causal-placeholder .empty-icon {
		font-size: 32px;
		margin-bottom: var(--spacing-sm);
	}

	.empty-mini {
		padding: var(--spacing-md);
		color: var(--color-gray-500);
		font-size: var(--text-xs);
		text-align: center;
	}

	/* === TCB 说明 === */
	.tcb-note {
		padding: var(--spacing-md);
		background: #fffbeb;
		border: 1px solid #fde68a;
		border-radius: var(--radius-md);
		margin-top: var(--spacing-md);
	}

	.tcb-note h2 {
		margin: 0 0 var(--spacing-sm) 0;
		font-size: var(--text-sm);
		color: #92400e;
		font-weight: 600;
		text-transform: uppercase;
	}

	.tcb-note dl {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: var(--spacing-xs) var(--spacing-md);
		margin: 0;
	}

	.tcb-note dt {
		font-size: var(--text-xs);
		color: #92400e;
		font-weight: 600;
	}

	.tcb-note dd {
		margin: 0;
		font-size: var(--text-xs);
		color: var(--color-gray-700);
	}

	.mono {
		font-family: var(--font-mono);
	}

	.error-banner {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		padding: var(--spacing-sm) var(--spacing-md);
		background: #fef2f2;
		border: 1px solid #fecaca;
		border-radius: var(--radius-md);
		color: var(--color-error);
		margin-bottom: var(--spacing-md);
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		min-height: 300px;
		color: var(--color-gray-500);
		text-align: center;
	}

	.empty-icon {
		font-size: 48px;
		margin-bottom: var(--spacing-md);
	}

	.empty-hint {
		font-size: var(--text-xs);
		margin-top: var(--spacing-xs);
	}

	@media (max-width: 900px) {
		.audit-body {
			grid-template-columns: 1fr;
		}

		.causal-panel {
			min-height: 200px;
		}
	}
</style>
