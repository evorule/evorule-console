// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 EvoRule Project
// evorule-console e2e — 视图导航切换 + 主题切换
//
// 依据: docs/IMPLEMENTATION_PLAN.md 阶段6
// 修订: 2026-08-03 e2e 并发竞态修复(workers: 1 + fullyParallel: false,配置问题非代码缺陷)
// 修订: 2026-09-11 适配 v0.2.0+ 路由架构(阶段 C.3.2):
//   - 规则库已升级为独立 /workspace 路由,根面板(/) 的 rules tab 点击后重定向
//   - StateView/AuditView 阶段 D.1.3/D.1.4 重写后不再渲染 h1,改用组件锚点断言
//   - 规则数据已迁移到 server workspace,离线时 /workspace 显示空状态(不再内置 builtin 规则)
//   - 消除重定向竞态:根面板测试经 addInitScript 预设视图为 'execution'
//     (init script 在文档创建前执行,早于 app JS,保证首次 goto('/') 即停留根面板)
//
// 不依赖 evorule-server(离线时各视图显示空状态/未连接,导航切换不依赖后端)
// 注:playwright 每个测试独立 browser context,localStorage 天然隔离,无需手动清理
//
// 运行: npx playwright test

import { test, expect, type Page } from '@playwright/test';

// 5 个导航 tab 的标签(对齐 VIEW_LIST)
const TABS = ['规则库', '执行台', '状态', '审计', '时间旅行'] as const;

// 根面板(/) 4 个分析视图 tab(规则库 tab 点击后重定向 /workspace,单独测)
const PANEL_TABS = ['执行台', '状态', '审计', '时间旅行'] as const;

// view store 的 localStorage 持久化 key(对齐 src/lib/stores/view.ts STORAGE_KEY)
const VIEW_STORAGE_KEY = 'evorule-console:current-view';

// 每个 tab 切到后应出现的稳定锚点(对齐各视图组件现结构)
//   执行台/时间旅行: <h1>;状态: 驾驶舱顶部状态栏 header.status-bar;
//   审计: 内联全页 AuditView 的 h2 标题(🔗 审计链)
const tabAnchor = (page: Page, tab: string) => {
  switch (tab) {
    case '执行台':
      return page.locator('h1', { hasText: '执行台' });
    case '状态':
      return page.locator('header.status-bar');
    case '审计':
      return page.locator('h2', { hasText: '审计链' });
    case '时间旅行':
      return page.locator('h1', { hasText: '时间旅行' });
    default:
      throw new Error(`未知 tab: ${tab}`);
  }
};

test.describe('evorule-console 根面板(/) — 4 分析视图导航', () => {

  test.beforeEach(async ({ page }) => {
    // 预设视图为 'execution':现架构下 rules 视图会重定向 /workspace,
    // 预设非 rules 视图让 / 稳定停留,消除"点击落在重定向后"的竞态。
    // 仅当 key 不存在时预设 — 不覆盖页面已持久化的视图(视图选择持久化测试依赖)
    await page.addInitScript((key) => {
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, 'execution');
      }
    }, VIEW_STORAGE_KEY);
    // waitUntil: 'networkidle' 让 vite dev server 完成首屏编译才继续
    await page.goto('/', { waitUntil: 'networkidle' });
    // 等 hydration 完成:data-theme 属性由 onMount 设置(prerender/SSR 不含此属性)
    await expect(page.locator('html')).toHaveAttribute('data-theme', /.+/, { timeout: 10_000 });
    // 确认停在根面板且预设视图已渲染(排除被重定向到 /workspace 的可能)
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('h1')).toHaveText('执行台');
  });

  test('页面加载 + 顶部品牌可见', async ({ page }) => {
    await expect(page.locator('.brand-name')).toHaveText('evorule-console');
    await expect(page.locator('.brand-tag')).toContainText('evorule 规则引擎面板');
  });

  test('导航包含 5 个 tab,标签正确', async ({ page }) => {
    const tabs = page.locator('.nav-tab .tab-label');
    await expect(tabs).toHaveCount(5);
    for (let i = 0; i < TABS.length; i++) {
      await expect(tabs.nth(i)).toHaveText(TABS[i]);
    }
  });

  for (const tab of PANEL_TABS) {
    test(`点击 "${tab}" tab → 切换到对应视图`, async ({ page }) => {
      await page.locator('.nav-tab', { hasText: tab }).click();
      const tabBtn = page.locator('.nav-tab', { hasText: tab });
      await expect(tabBtn).toHaveAttribute('aria-pressed', 'true');
      // 该视图的稳定锚点出现(状态/审计视图重写后无 h1,用组件锚点)
      await expect(tabAnchor(page, tab)).toBeVisible();
    });
  }

  test('点击 "规则库" tab → 重定向到 /workspace', async ({ page }) => {
    await page.locator('.nav-tab', { hasText: '规则库' }).click();
    // 阶段 C.3.2:规则库升级为独立路由,点击即跳转(当前面板不再渲染规则库)
    await page.waitForURL('**/workspace', { timeout: 10_000 });
    await expect(page.locator('h2', { hasText: '规则列表' })).toBeVisible();
  });

  test('同一时刻只有一个 tab active(4 分析视图循环)', async ({ page }) => {
    for (const tab of PANEL_TABS) {
      await page.locator('.nav-tab', { hasText: tab }).click();
      const activeCount = await page.locator('.nav-tab[aria-pressed="true"]').count();
      expect(activeCount).toBe(1);
    }
  });

  test('主题切换 — 点击切换 light/dark', async ({ page }) => {
    const html = page.locator('html');
    const toggle = page.locator('.theme-toggle');

    // 确认 onMount 已设置 data-theme(hydration 完成的附加证据)
    await expect(html).toHaveAttribute('data-theme', /.+/, { timeout: 5000 });
    const initialTheme = await html.getAttribute('data-theme');

    // 点击切换
    await toggle.click();
    await expect(html).toHaveAttribute('data-theme', initialTheme === 'dark' ? 'light' : 'dark');

    // 再点切回
    await toggle.click();
    await expect(html).toHaveAttribute('data-theme', initialTheme ?? 'light');
  });

  test('连接徽标渲染(检测中/已连接/未连接 三态之一)', async ({ page }) => {
    const badge = page.locator('.conn-badge');
    await expect(badge).toBeVisible();
    // 文本应为三态之一(无 evorule-server 时最终变为"未连接")
    await expect(badge.locator('.conn-text')).toHaveText(/检测中|已连接|未连接/);
  });

  test('视图选择持久化 — 切到审计后刷新仍恢复审计', async ({ page }) => {
    await page.locator('.nav-tab', { hasText: '审计' }).click();
    await expect(page.locator('.nav-tab', { hasText: '审计' })).toHaveAttribute('aria-pressed', 'true');
    // 刷新(view 持久化到 localStorage,测恢复;init script 与持久化同值,不干扰)
    await page.reload({ waitUntil: 'networkidle' });
    // 等 hydration 完成 → restoreView() 应从 localStorage 恢复"审计"
    await expect(
      page.locator('.nav-tab', { hasText: '审计' })
    ).toHaveAttribute('aria-pressed', 'true', { timeout: 10_000 });
  });
});

test.describe('evorule-console 默认视图 rules → 重定向 /workspace', () => {

  test('未持久化视图时,/ 自动重定向到 /workspace', async ({ page }) => {
    // 新 context 无 localStorage:currentView 保持默认 'rules',
    // restoreView 置 restored=true 后,根面板 $effect 重定向到 /workspace
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForURL('**/workspace', { timeout: 10_000 });
  });

  test('规则库路由离线可达 — 空状态可渲染', async ({ page }) => {
    // 规则数据已迁移到 server workspace(v0.2.0 架构),离线时无 server:
    // 页面骨架(规则列表标题 + 空状态提示)仍应可渲染,不白屏
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForURL('**/workspace', { timeout: 10_000 });
    await expect(page.locator('h2', { hasText: '规则列表' })).toBeVisible();
    await expect(page.getByText('暂无规则')).toBeVisible();
  });
});
