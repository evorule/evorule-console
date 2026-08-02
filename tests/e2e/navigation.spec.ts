// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 EvoRule Project
// evorule-console e2e — 5 视图导航切换 + 主题切换
//
// 依据: docs/IMPLEMENTATION_PLAN.md 阶段6
// 修订: 2026-08-03 e2e 并发竞态修复(workers: 1 + fullyParallel: false,配置问题非代码缺陷)
//
// 不依赖 evorule-server(规则库视图离线可用;其他视图切到时显示空状态/未连接,
// 但导航 tab 切换 + 规则库内容不依赖后端)
//
// 关键:每次测试前清 localStorage + 重载 + 等 hydration 完成(默认"规则库"tab active),
//       避免点击落在 hydration 前导致 onclick 未绑定。
//
// 并发修复(2026-08-03):
//   page.goto 加 waitUntil: 'networkidle' — 让 vite dev server 完成首屏编译才继续,
//   避免多 worker 并发 page.goto 时 vite 首屏编译未完成、onMount 滞后导致 hydration signal timeout。
//   注:配合 playwright.config.ts 的 workers=1,双保险。
//
// 运行: npx playwright test

import { test, expect } from '@playwright/test';

// 5 个导航 tab 的标签(对齐 VIEW_LIST)
const TABS = ['规则库', '执行台', '状态', '审计', '时间旅行'] as const;

// 每个 tab 切到后应出现的 h1(对齐各视图 .svelte 的 <h1>)
const TAB_TO_H1: Record<string, string> = {
  '规则库': '规则库',
  '执行台': '执行台',
  '状态': '状态视图',
  '审计': '审计视图',
  '时间旅行': '时间旅行'
};

test.describe('evorule-console 导航', () => {

  test.beforeEach(async ({ page }) => {
    // waitUntil: 'networkidle' 让 vite dev server 完成首屏编译才继续
    // (避免并发场景下 vite 还在编译,onMount 滞后导致 data-theme signal timeout)
    await page.goto('/', { waitUntil: 'networkidle' });
    // 清 localStorage(view + theme 持久化会跨测试串扰)+ 重载确保干净状态
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle' });
    // 等 hydration 完成:data-theme 属性由 onMount 设置(prerender/SSR 不含此属性)。
    // 不能用"规则库 tab active"作信号 — adapter-static prerender 已在静态 HTML 渲染默认视图,
    // 该信号会立即满足但 onclick 尚未绑定,导致点击竞态。
    await expect(page.locator('html')).toHaveAttribute('data-theme', /.+/, { timeout: 10_000 });
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

  test('默认视图是规则库(active + h1)', async ({ page }) => {
    const rulesTab = page.locator('.nav-tab', { hasText: '规则库' });
    await expect(rulesTab).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('h1')).toHaveText('规则库');
  });

  for (const tab of TABS) {
    test(`点击 "${tab}" tab → 切换到对应视图`, async ({ page }) => {
      await page.locator('.nav-tab', { hasText: tab }).click();
      const tabBtn = page.locator('.nav-tab', { hasText: tab });
      await expect(tabBtn).toHaveAttribute('aria-pressed', 'true');
      // 该视图的 h1 出现(各视图 header 始终渲染 h1,不受 backend 门控)
      await expect(page.locator('h1', { hasText: TAB_TO_H1[tab] })).toBeVisible();
    });
  }

  test('同一时刻只有一个 tab active', async ({ page }) => {
    for (const tab of TABS) {
      await page.locator('.nav-tab', { hasText: tab }).click();
      const activeCount = await page.locator('.nav-tab[aria-pressed="true"]').count();
      expect(activeCount).toBe(1);
    }
  });

  test('规则库视图离线可用 — 含 builtin 规则', async ({ page }) => {
    // 规则库不依赖 backend,应显示内置示例规则(set_basic 是 3 个内置示例之一)
    await expect(page.locator('h1')).toHaveText('规则库');
    await expect(page.getByText('set_basic', { exact: false }).first()).toBeVisible({ timeout: 5000 });
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
    // 刷新(不清 localStorage,测持久化恢复)
    await page.reload();
    // 等 hydration 完成 → restoreView() 应从 localStorage 恢复"审计"
    await expect(
      page.locator('.nav-tab', { hasText: '审计' })
    ).toHaveAttribute('aria-pressed', 'true', { timeout: 10_000 });
  });
});
