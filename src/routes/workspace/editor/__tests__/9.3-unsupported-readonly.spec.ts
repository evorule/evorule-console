// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 EvoRule Project
//! V1 检查表 §9.3 自动化脚本 — 验证 unsupported 规则表单 9 个控件的 disabled 状态
//!
//! 对应 `10_V1浏览器手动测试检查表.md` 步骤 9.3 (9 项验证)。
//!
//! ================================================================
//! 前置条件
//! ================================================================
//!   1. console 跑在 http://localhost:5173
//!      evorule-console> npm run dev          (端口 = 5173)
//!   2. server  跑在 http://127.0.0.1:18080
//!      evorule-server> cargo run --bin evorule-server -- --addr 127.0.0.1:18080 --allowed-origins http://localhost:5173
//!   3. workspace.db 内已有工作空间 (若没有,先走 onboarding 创建一个)
//!   4. Playwright 浏览器已安装 (首次需执行: npx playwright install chromium)
//!
//! ================================================================
//! 执行方式
//! ================================================================
//!   # 方式 A: 直接传路径 + 禁用外部配置(testDir 未配时兜底匹配 **/*.spec.ts)
//!   npx playwright test --config=\`{}\` --testMatch=**/9.3-unsupported-readonly.spec.ts --baseURL http://localhost:5173 --headed src/routes/workspace/editor/__tests__/9.3-unsupported-readonly.spec.ts
//!
//!   # 方式 B(推荐,省心): 先写最小 playwright.config.ts 到项目根 (见附录 A), 再:
//!   npx playwright test 9.3-unsupported-readonly --headed
//!
//!   # 方式 C: 如项目用 @vitest/browser + playwright, 把 import/@playwright/test 换成 vitest 风格 (见附录 B)
//!   npx vitest run src/routes/workspace/editor/__tests__/9.3-unsupported-readonly.spec.ts
//!
//! ================================================================
//! 附录 A: 最小 playwright.config.ts (放项目根 playwright.config.ts)
//! ================================================================
//!   import { defineConfig, devices } from "@playwright/test";
//!   export default defineConfig({
//!     testDir: "./",                                   // 从项目根搜 *.spec.ts
//!     testMatch: "**/__tests__/**/*.spec.ts",          // 本脚本路径匹配
//!     fullyParallel: false,
//!     use: {
//!       baseURL: "http://localhost:5173",
//!       headless: false,
//!     },
//!     projects: [{ name: "chromium", use: devices["Desktop Chrome"] }],
//!   });
//!
//! ================================================================
//! 附录 B: 如改用 @vitest/browser + playwright provider (vitest.config.ts)
//! ================================================================
//!   import { defineConfig } from "vitest/config";
//!   export default defineConfig({
//!     test: {
//!       browser: { enabled: true, provider: "playwright", name: "chromium", headless: false },
//!     },
//!   });

import { test, expect, type Page, type Locator } from "@playwright/test";

// ================================================================
// 被测规则的 JSON (example.set_basic 结构,含 `attr: "__exec__.payload.x"`)
// 由于 set 的 attr 不在业务动作白名单 (__exec__.result.{notify|approve|flag}),
// translateOutputToBusinessRule 会返回 unsupported: true → 表单只读。
// ================================================================
const UNSUPPORTED_RULE_JSON = {
  id: "example.set_basic_e2e",
  version: 1,
  description: "§9.3 自动化测试 — unsupported 只读验证",
  transform: [
    {
      type: "set",
      params: {
        attr: "__exec__.payload.x",
        operation: "set",
        value: 1,
      },
    },
    {
      type: "branch",
      params: {
        domain: { type: "all", domains: [] },
        on_true: [],
      },
    },
  ],
};

// ================================================================
// 9.3 节要验证的控件定义: 定位器 → 断言条件 → 检查表编号
//
// 定位策略(吸取 299923 经验):
//   1. 编辑器的 <section class="form-section"> 没有 aria-label, 所以不能用
//      getByRole("region", { name }) 作为作用域(会匹配不到)。
//   2. 改为按 h3.form-title 的可见文本 → 定位到父 section → 在 section 内找控件,
//      与"列头→单元格→控件"的映射思路一致, 避免命中页面其他区域的同名控件。
//   3. 避免在 evaluate 内使用 :has-text 等 Playwright 伪选择器 (标准 DOM 不支持)。
// ================================================================
type ControlSpec = {
  id: string;          // 检查表编号
  desc: string;        // 人类可读描述
  locate: (page: Page) => Locator;  // 定位器(在作用域内找到唯一元素)
  mustBeDisabled?: boolean;          // true=必须 disabled, false=必须 enabled(默认 true)
};

/**
 * 按 section 标题返回该 form-section 容器的 locator。
 * 等价于"先定位列头 '条件', 再取所在 table 作用域"。
 */
function getSectionByTitle(page: Page, titleText: string): Locator {
  // .form-section:has(h3.form-title:text-is("titleText")) 语义等价实现
  // (使用 nth=0 因为标题在文档中唯一; 不依赖 Playwright 专有伪选择器用于标准 CSS)
  return page
    .locator(".form-section", {
      has: page.locator("h3.form-title").filter({ hasText: new RegExp(`^${titleText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s|$)`) }),
    })
    .first();
}

const CONTROLS: ControlSpec[] = [
  // ── 9.3.1 条件区「+ 添加」按钮 ────────────────────────────
  {
    id: "9.3.1",
    desc: "条件区「+ 添加」按钮 disabled",
    locate: (page) =>
      getSectionByTitle(page, "条件").getByRole("button", { name: "+ 添加" }),
  },

  // ── 9.3.2 动作区「+ 添加」按钮 ────────────────────────────
  {
    id: "9.3.2",
    desc: "动作区「+ 添加」按钮 disabled",
    locate: (page) =>
      getSectionByTitle(page, "动作").getByRole("button", { name: "+ 添加" }),
  },

  // ── 9.3.3 字段下拉框 ─────────────────────────────────────
  //   条件 section 下 aria-label="字段" 的 <select class="cond-field">
  {
    id: "9.3.3",
    desc: "字段下拉框 disabled",
    locate: (page) => getSectionByTitle(page, "条件").getByLabel("字段"),
  },

  // ── 9.3.4 比较符下拉框 ───────────────────────────────────
  {
    id: "9.3.4",
    desc: "比较符下拉框 disabled",
    locate: (page) => getSectionByTitle(page, "条件").getByLabel("比较符"),
  },

  // ── 9.3.5 值输入框 ───────────────────────────────────────
  {
    id: "9.3.5",
    desc: "值输入框 disabled",
    locate: (page) => getSectionByTitle(page, "条件").getByLabel("值"),
  },

  // ── 9.3.6 动作下拉框 ─────────────────────────────────────
  //   动作 section 下 aria-label="动作" 的 <select class="cond-field">
  //   (与条件区的"字段" select 同 class 不同 section, getSectionByTitle 作用域避免混淆)
  {
    id: "9.3.6",
    desc: "动作下拉框 disabled",
    locate: (page) => getSectionByTitle(page, "动作").getByLabel("动作"),
  },

  // ── 9.3.7 角色输入框 ─────────────────────────────────────
  {
    id: "9.3.7",
    desc: "角色输入框 disabled",
    locate: (page) => getSectionByTitle(page, "动作").getByLabel("角色"),
  },

  // ── 9.3.8 条件行「✕」删除按钮 ────────────────────────────
  //   set_basic 只有 set 指令没有 branch, 回译后 conditions 可能为空,
  //   此时不会渲染 ✕ 按钮。 兼容两种情况:
  //   - 有条件 → 验证 ✕ 按钮 disabled
  //   - 无条件 → 验证「添加」按钮禁用即可 (条件数 = 0 无法验证删除按钮,
  //     但 removeCondition 函数不被调用 → 逻辑安全)
  {
    id: "9.3.8",
    desc: "条件行「✕」删除按钮 disabled (若存在)",
    locate: (page) =>
      getSectionByTitle(page, "条件").getByRole("button", { name: "✕" }),
  },

  // ── 9.3.9 动作行「✕」删除按钮 ────────────────────────────
  //   set_basic 的 set.value = 1 (数字, 非 {role, action} 对象),
  //   回译时无法匹配 role/action → actions 可能为空。同样兼容。
  {
    id: "9.3.9",
    desc: "动作行「✕」删除按钮 disabled (若存在)",
    locate: (page) =>
      getSectionByTitle(page, "动作").getByRole("button", { name: "✕" }),
  },
];

// ================================================================
// 测试用例
// ================================================================

test.describe("§9.3 unsupported 规则表单 9 控件 disabled 状态验证", () => {

  let workspaceId: string;

  // ── 前置: 导航 + 创建工作空间(若需要) + 创建 unsupported 规则 ──
  test.beforeAll(async ({ browser, baseURL }) => {
    const page = await browser.newPage();
    const root = baseURL ?? "http://localhost:5173";

    await page.goto(`${root}/workspace`);

    // 等待已连接(等待顶部状态栏显示「已连接」而非「检测中」)
    await page.waitForFunction(() => {
      return document.body.innerText.includes("已连接");
    }, { timeout: 15000 });

    // 取当前工作空间 id (从下拉框值)
    workspaceId = await page.evaluate<string>(() => {
      // workspace 页面的当前空间下拉通常是 <select> 或带 aria-label
      const select = document.querySelector<HTMLSelectElement>(
        'select[aria-label="当前空间"], select[name="workspace"]'
      );
      if (select?.value) return select.value;

      // 或从 URL search params 取
      const u = new URL(location.href);
      const fromUrl = u.searchParams.get("workspace_id");
      if (fromUrl) return fromUrl;

      // 兜底: 取第一个 <option value> (第一个工作空间)
      const firstOption = select?.querySelector<HTMLOptionElement>("option");
      return firstOption?.value ?? "";
    });
    expect(workspaceId, "workspaceId 非空").not.toBe("");

    await page.close();
  });

  // ── 主用例: 创建 unsupported 规则 → 进入编辑器 → 验证 9 控件 ──
  test("9 控件 disabled 状态全部符合预期", async ({ page, baseURL, request }) => {
    const root = baseURL ?? "http://localhost:5173";
    const apiBase = "http://127.0.0.1:18080";
    let ruleId: string;

    // ── Step A: 通过 HTTP API 直接创建 unsupported 规则 (避免表单点击不稳定) ──
    //   吸取 299923 经验: 关键前置不要依赖"填表单→保存"的链式交互,
    //   直接调用 server workspace API 插 rule, 稳定性更高。
    {
      // 1. 列工作空间确保 workspaceId 合法 (取第一个 id)
      const listResp = await request.get(`${apiBase}/api/workspaces`);
      expect(listResp.status()).toBe(200);
      const list = await listResp.json();
      expect(Array.isArray(list)).toBe(true);
      expect(list.length).toBeGreaterThan(0);
      const ws = list[0];
      workspaceId = ws.id;
      ruleId = "";

      // 2. 先尝试删除同名残留规则 (保证幂等)
      const rulesResp = await request.get(`${apiBase}/api/workspaces/${workspaceId}/rules`);
      expect(rulesResp.status()).toBe(200);
      const rules = (await rulesResp.json()) as Array<{ id: string; name: string }>;
      const old = rules.find((r) => r.name === UNSUPPORTED_RULE_JSON.id);
      if (old) {
        try {
          await request.delete(`${apiBase}/api/workspaces/${workspaceId}/rules/${old.id}`);
        } catch {
          /* 忽略删除失败, 创建时若冲突再报错 */
        }
      }

      // 3. 创建规则 (对齐 workspace-types.ts CreateRuleRequest:
      //   { name, content, created_by, description? })
      const createResp = await request.post(
        `${apiBase}/api/workspaces/${workspaceId}/rules`,
        {
          data: {
            name: UNSUPPORTED_RULE_JSON.id,
            description: UNSUPPORTED_RULE_JSON.description,
            content: JSON.stringify(UNSUPPORTED_RULE_JSON),
            created_by: "e2e-9.3-unsupported",
          },
        }
      );
      expect(createResp.status(), "createRule 应返回 200/201").toBeLessThan(300);
      const created = await createResp.json();
      // RuleRecord 顶层字段: id(ULID), name, state, created_at, metadata, current_version_id 等
      ruleId = created.id ?? created.rule_id ?? created.ulid;
      expect(ruleId, "新规则应返回 id").toBeTruthy();
    }

    // ── Step B: 浏览器进入编辑器 ──
    await page.goto(`${root}/workspace/editor/${ruleId}`);
    // 等待编辑器加载 — 等「保存」按钮出现 (避免过早检查 disabled)
    await page.waitForSelector('button:has-text("保存")', { timeout: 15000 });
    // 等待 form 模式加载完成(默认 form tab 选中)
    await page.waitForFunction(() => {
      const formTab = Array.from(document.querySelectorAll<HTMLElement>('[role="tab"]')).find(
        (el) => el.textContent?.includes("表单")
      );
      return formTab?.getAttribute("aria-selected") === "true";
    }, { timeout: 10000 });

    // ── Step C: 验证 unsupported 横幅存在 (是进入只读的前提) ──
    await expect(
      page.getByText("⚠ 超出业务表单范围"),
      "unsupported 横幅应出现, 否则表单可能未进入只读状态导致下面所有 disabled 断言误判"
    ).toBeVisible({ timeout: 10000 });

    // ── Step D: 逐一检查 9 个控件 ────────────────────────────────
    //   输出结构化报告用于 10_*检查表 归档, 失败时打印 DOM 快照便于排查。
    const report: Array<{ id: string; desc: string; pass: boolean; detail: string }> = [];

    for (const spec of CONTROLS) {
      const loc = spec.locate(page);
      const count = await loc.count();

      if (count === 0) {
        // 9.3.8 / 9.3.9 允许不存在 (conditions/actions 为空时不渲染 ✕ 按钮)
        const allowMissing = spec.id === "9.3.8" || spec.id === "9.3.9";
        report.push({
          id: spec.id,
          desc: spec.desc,
          pass: allowMissing,
          detail: allowMissing
            ? "控件不存在 (conditions/actions 为空) — 按允许缺失处理"
            : "控件不存在且不属于 allowMissing 清单 → FAIL",
        });
        if (!allowMissing) {
          // 打印 section 内当前可见元素辅助定位 (吸取 299923 经验)
          const dump = await page.evaluate(() => {
            const sections = document.querySelectorAll<HTMLElement>(".form-section");
            return Array.from(sections).map((s) => {
              const h = s.querySelector<HTMLElement>(".form-title")?.innerText;
              const interactive = Array.from(
                s.querySelectorAll<HTMLElement>("button, select, input")
              ).map((el) => ({
                tag: el.tagName,
                cls: el.getAttribute("class")?.slice(0, 40) ?? "",
                ariaLabel: el.getAttribute("aria-label") ?? "",
                text: (el.textContent ?? "").trim().slice(0, 30),
                disabled: el.hasAttribute("disabled"),
              }));
              return { section: h, elements: interactive };
            });
          });
          console.error("§9.3 元素缺失诊断 dump:", JSON.stringify(dump, null, 2));
        }
        continue;
      }

      // count >= 1: 检查第一个元素 (set_basic 回译最多 1 条件和 1 动作,
      // 若多条件/多动作是 unsuported 规则异常, 首元素就足以验证 disabled 语义)
      const first = loc.first();
      const isDisabled = await first.evaluate<boolean, HTMLButtonElement | HTMLSelectElement | HTMLInputElement>(
        (el) => el.hasAttribute("disabled") || (el as HTMLInputElement).disabled
      );
      const expected = spec.mustBeDisabled ?? true;
      const pass = isDisabled === expected;
      report.push({
        id: spec.id,
        desc: spec.desc,
        pass,
        detail: `实际 disabled=${isDisabled}, 预期=${expected}`,
      });

      // 断言 (用 Playwright 原生 expect 获得 readable diff)
      if (expected) {
        await expect(first, `${spec.id} ${spec.desc}`).toBeDisabled({ timeout: 2000 });
      } else {
        await expect(first, `${spec.id} ${spec.desc}`).toBeEnabled({ timeout: 2000 });
      }
    }

    // ── Step E: 输出人类可读报告 (复制粘贴到检查表即可) ──
    console.log("\n═══════════════════════════════════════════════");
    console.log("§9.3 unsupported 表单 disabled 状态验证报告");
    console.log("工作空间 ID: " + workspaceId);
    console.log("规则 ID: " + ruleId);
    console.log("═══════════════════════════════════════════════");
    let passN = 0, failN = 0;
    for (const r of report) {
      const mark = r.pass ? "✅" : "❌";
      console.log(`${mark} ${r.id}  ${r.desc}`);
      console.log(`      ${r.detail}`);
      if (r.pass) passN++; else failN++;
    }
    console.log("───────────────────────────────────────────────");
    console.log(
      `汇总: 通过 ${passN}/${report.length} · 失败 ${failN}/${report.length}`
    );
    console.log("═══════════════════════════════════════════════\n");

    expect(failN, `${failN} 项控件 disabled 状态不符合预期`).toBe(0);
  });
});

// ================================================================
// 附录: 若项目用 vitest + @vitest/browser (无 @playwright/test),
// 请把上面整个文件改写为 vitest 风格: 用 browser.page (from @vitest/browser)
// 代替 test / expect / Locator, 断言库用 vitest 的 expect, 其余逻辑不变。
// 下面是等价片段:
//
//   import { beforeAll, test, expect } from "vitest";
//   import { page } from "@vitest/browser/context";
//   import { http, HttpResponse } from "msw"; // 或直接 fetch
//
//   // browser.page.locator() → page.getByRole(...) 接口相同
//   // 断言: element.disabled → await expect(element).toHaveAttribute("disabled")
// ================================================================
