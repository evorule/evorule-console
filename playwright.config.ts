// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 EvoRule Project
// evorule-console e2e 测试配置(playwright)
//
// 依据: docs/IMPLEMENTATION_PLAN.md 阶段6
// 修订: 2026-08-03 e2e 并发竞态修复(workers: 1 + fullyParallel: false,配置问题非代码缺陷)
//
// 运行: npx playwright test
// 首次运行需装浏览器: npx playwright install chromium
//
// 并发修复说明:
//   原配置 fullyParallel: true + workers: undefined(默认 5-10 worker)
//   → 多 worker 并发 page.goto('/') 触发 vite dev 首屏并发编译 → vite 卡顿
//   → onMount 不及时执行 → data-theme hydration signal 10s timeout
//   串行 13/13 PASS 证明代码无缺陷,纯配置问题。
//   修复:本地强制 workers=1 + fullyParallel=false + webServer.stdout=pipe
//   防御:配合 navigation.spec.ts 的 page.goto({ waitUntil: 'networkidle' })

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // 防御:禁用文件级并行(避免未来加多文件再踩同类坑)
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // 本地+CI 均强制单 worker(evorule-console 13 e2e 串行 27.9s 可接受)
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    actionTimeout: 10_000 // 防御:单步动作超时(避免卡死)
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    stdout: 'pipe' // 保留 vite 启动日志(出问题时能看到 vite 编译进度)
  }
});
