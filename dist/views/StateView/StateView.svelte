<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (C) 2026 EvoRule Project -->
<!-- evorule-console 状态视图 — 展现 evorule "JSON-in/out 自解释" -->
<!--
  依据: docs/SPEC.md §2.1
  职责:
    - 当前 session 的 payload 可视化(折叠 JSON 树)
    - reactor 状态(phase/step/causal_depth/pending_io)
    - 体现 "JSON-in/out 自解释":用户直接读 JSON 理解状态
-->

<script lang="ts">
	import {
		sessionState,
		reactorPhase,
		reactorVersion,
		reactorCausalDepth,
		reactorPendingIO,
		isLoading,
		lastError,
		currentSessionId,
		refreshSessionState
	} from '../../stores/session';
	import { useBackendOrNull } from '../../backend/backend-context';
	import JsonTree from './JsonTree.svelte';

	const backend = useBackendOrNull();

	function handleRefresh() {
		if (!backend) return;
		refreshSessionState(backend);
	}

	const phaseLabels: Record<string, { text: string; class: string }> = {
		idle: { text: '空闲', class: 'phase-idle' },
		awaiting_io: { text: '等待 IO', class: 'phase-awaiting' },
		stable: { text: '稳态', class: 'phase-stable' },
		error: { text: '异常', class: 'phase-error' }
	};
</script>

<div class="state-view">
	<header class="view-header">
		<div class="title-group">
			<h1>状态视图</h1>
			<span class="subtitle">JSON-in/out 自解释 — 直接读 JSON 理解状态</span>
		</div>
		<div class="actions">
			<button class="btn" onclick={handleRefresh} disabled={!backend || $isLoading}>
				{$isLoading ? '刷新中...' : '刷新'}
			</button>
		</div>
	</header>

	{#if !backend}
		<div class="empty-state">
			<span class="empty-icon">🔌</span>
			<p>backend 未注入(开发期需要 evorule-server)</p>
		</div>
	{:else if $lastError}
		<div class="error-banner" role="alert">
			<span>⚠</span>
			<span>{$lastError}</span>
		</div>
	{:else if $currentSessionId === null}
		<div class="empty-state">
			<span class="empty-icon">📭</span>
			<p>无当前 session</p>
			<p class="empty-hint">先到执行台创建 session</p>
		</div>
	{:else if $sessionState}
		{@const state = $sessionState}
		<section class="reactor-panel">
			<h2>Reactor 状态</h2>
			<dl class="reactor-grid">
				<div class="reactor-item">
					<dt>session</dt>
					<dd class="mono">{$currentSessionId}</dd>
				</div>
				<div class="reactor-item">
					<dt>version</dt>
					<dd class="mono">{state.version}</dd>
				</div>
				<div class="reactor-item">
					<dt>phase</dt>
					<dd>
						<span class="phase-badge {phaseLabels[state.reactor.phase]?.class ?? ''}">
							{phaseLabels[state.reactor.phase]?.text ?? state.reactor.phase}
						</span>
					</dd>
				</div>
				<div class="reactor-item">
					<dt>step</dt>
					<dd class="mono">{state.reactor.current_step}</dd>
				</div>
				<div class="reactor-item">
					<dt>causal_depth</dt>
					<dd class="mono">{state.reactor.causal_depth}</dd>
				</div>
				<div class="reactor-item">
					<dt>pending_io</dt>
					<dd class="mono">{state.reactor.pending_io_count}</dd>
				</div>
				<div class="reactor-item">
					<dt>invariant_violations</dt>
					<dd class="mono" class:warn={state.reactor.structural_invariant_violations > 0}>
						{state.reactor.structural_invariant_violations}
					</dd>
				</div>
			</dl>
		</section>

		<section class="payload-panel">
			<h2>Payload</h2>
			<p class="panel-hint">JSON 树可折叠 — 体现"自解释"</p>
			{#if state.payload && Object.keys(state.payload).length > 0}
				<div class="json-tree-container">
					<JsonTree data={state.payload} rootLabel="payload" />
				</div>
			{:else}
				<div class="empty-payload">
					<span>(空 payload — 提交命令后此处理论会有数据)</span>
				</div>
			{/if}
		</section>

		{#if state.queue && state.queue.length > 0}
			<section class="queue-panel">
				<h2>Queue ({state.queue.length})</h2>
				<div class="json-tree-container">
					<JsonTree data={state.queue} rootLabel="queue" />
				</div>
			</section>
		{/if}
	{:else}
		<div class="empty-state">
			<span class="empty-icon">⏳</span>
			<p>{$isLoading ? '加载中...' : '无状态数据,点"刷新"'}</p>
		</div>
	{/if}
</div>

<style>
	.state-view {
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

	.reactor-panel,
	.payload-panel,
	.queue-panel {
		margin-bottom: var(--spacing-lg);
		padding: var(--spacing-md);
		background: white;
		border: 1px solid var(--color-gray-200);
		border-radius: var(--radius-md);
	}

	.reactor-panel h2,
	.payload-panel h2,
	.queue-panel h2 {
		margin: 0 0 var(--spacing-md) 0;
		font-size: var(--text-sm);
		font-weight: 600;
		color: var(--color-gray-700);
		text-transform: uppercase;
		border-bottom: 1px solid var(--color-gray-200);
		padding-bottom: var(--spacing-sm);
	}

	.panel-hint {
		margin: 0 0 var(--spacing-sm) 0;
		font-size: var(--text-xs);
		color: var(--color-gray-500);
		font-style: italic;
	}

	.reactor-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
		gap: var(--spacing-md);
		margin: 0;
	}

	.reactor-item {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.reactor-item dt {
		font-size: var(--text-xs);
		color: var(--color-gray-500);
		font-weight: 600;
		text-transform: uppercase;
	}

	.reactor-item dd {
		margin: 0;
		font-size: var(--text-base);
		color: var(--color-gray-900);
	}

	.mono {
		font-family: var(--font-mono);
	}

	.mono.warn {
		color: var(--color-error);
		font-weight: 600;
	}

	.phase-badge {
		display: inline-block;
		padding: 2px 8px;
		border-radius: var(--radius-sm);
		font-size: var(--text-xs);
		font-weight: 600;
	}

	.phase-idle {
		background: var(--color-gray-100);
		color: var(--color-gray-700);
	}

	.phase-awaiting {
		background: #fef3c7;
		color: #92400e;
	}

	.phase-stable {
		background: #d1fae5;
		color: #065f46;
	}

	.phase-error {
		background: #fee2e2;
		color: #991b1b;
	}

	.json-tree-container {
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		line-height: 1.6;
		max-height: 400px;
		overflow: auto;
		padding: var(--spacing-sm);
		background: var(--color-gray-50);
		border-radius: var(--radius-md);
	}

	.empty-payload {
		padding: var(--spacing-md);
		color: var(--color-gray-500);
		font-style: italic;
		text-align: center;
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
</style>
