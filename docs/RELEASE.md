<!-- SPDX-License-Identifier: CC-BY-4.0 -->
<!-- Copyright (C) 2026 EvoRule Project -->

# evorule-console 发版流程(RELEASE SOP)

本文档定义 `@evorule/console` 的发版标准操作流程(SOP)。每次发版必须按此流程逐项执行,确保:

1. **版本号一致**:`package.json` / `CONSOLE_VERSION` / README 徽标 / CHANGELOG 四处同步
2. **质量门禁**:svelte-check / vitest / playwright 三道测试全绿
3. **可安装性**:`dist/` 强制提交,使大众版能经 git URL 直接安装,无需本地 `npm run prepack`

> 本仓遵循独立 semver,与大众版(`evorule-console-cloud`)/ 高级版版本松绑。

---

## 0. 前置检查(每次发版必做)

- [ ] 当前分支为 `main`(或发版分支),工作区干净(`git status` 无未提交改动)
- [ ] 远程 `origin` 指向 `https://gitee.com/evo-rule-lab/evorule-console.git`
- [ ] 已与最新 `origin/main` 同步(`git pull --ff-only`)

---

## 1. 版本号同步(四处)

假设发版目标版本为 `X.Y.Z`(如 `0.1.1`),以下四处必须同步:

| # | 文件                              | 字段 / 位置                  | 旧值示例     | 新值           |
| - | --------------------------------- | ---------------------------- | ------------ | -------------- |
| 1 | `package.json`                    | `"version"`                  | `"0.1.0"`    | `"X.Y.Z"`      |
| 2 | `src/lib/index.ts`                | `CONSOLE_VERSION`            | `'0.1.0'`    | `'X.Y.Z'`      |
| 3 | `README.md`                       | 版本徽标 markdown            | `version-0.1.0` | `version-X.Y.Z` |
| 4 | `CHANGELOG.md`                    | 顶部新增 `## [X.Y.Z] - YYYY-MM-DD` 条目 | —            | 新增条目      |

**校验命令**:

```powershell
# 1. package.json
node -p "require('./package.json').version"
# 2. CONSOLE_VERSION
node -p "require('fs').readFileSync('src/lib/index.ts','utf8').match(/CONSOLE_VERSION = '([^']+)'/)[1]"
# 3. README 徽标
Select-String -Path README.md -Pattern 'version-\d+\.\d+\.\d+'
# 4. CHANGELOG 顶部条目
Select-String -Path CHANGELOG.md -Pattern '^## \[' | Select-Object -First 1
```

四处一致后才能进入下一步。

---

## 2. 质量门禁(三道测试全绿)

按顺序执行,任一失败即中止发版:

```bash
# 2.1 类型检查(svelte-check)
npm run check
# 期望:0 errors / 0 warnings

# 2.2 单元测试(vitest)
npm run test:unit
# 期望:9 files / 265 tests passed(v0.1.1 基线)

# 2.3 e2e 测试(playwright,单 worker)
npm run test
# 期望:13/13 passed
```

> e2e 必须单 worker(`playwright.config.ts` 中 `workers: 1`),多 worker 会触发 Vite dev server 冷启动竞态(已知限制,非代码缺陷)。

测试结果记录到 `CHANGELOG.md` 对应版本的「### 测试」表格。

---

## 3. 构建 npm 包产物(`dist/`)

```bash
# 3.1 清理旧产物(避免残留过期文件)
Remove-Item -Recurse -Force dist -ErrorAction SilentlyContinue

# 3.2 产出 dist/(svelte-kit sync + svelte-package)
npm run prepack
```

**校验**:

```powershell
# dist/ 存在 + 关键文件
Test-Path dist/index.js
Test-Path dist/index.d.ts
# 导出可解析
node -p "require('./dist/index.js').CONSOLE_VERSION"
# 期望输出 X.Y.Z
```

---

## 4. 提交发版 commit + tag

### 4.1 暂存改动(注意 `dist/` 强制提交)

`.gitignore` 中 `dist/` 被忽略(开发期不污染 git),但发版时必须**强制提交** `dist/`,否则大众版经 git URL 安装时拿不到产物。

```powershell
# 4.1.1 普通改动(代码 + 文档)
git add package.json src/lib/index.ts README.md CHANGELOG.md docs/RELEASE.md

# 4.1.2 强制提交 dist/(关键!)
git add -f dist/
```

> **不要**用 `git add -A` 或 `git add .` — 会把 `test-results/`、`*.log`、`.svelte-kit/` 等本应忽略的产物一起提交。必须显式 add 上述文件 + `git add -f dist/`。

### 4.2 验证暂存区干净

```powershell
git status
# 应看到:
#   modified:   package.json
#   modified:   src/lib/index.ts
#   modified:   README.md
#   modified:   CHANGELOG.md
#   modified:   docs/RELEASE.md(若本文件有改动)
#   new file:   dist/(强制添加)
#
# 不应看到:
#   test-results/  *.log  .svelte-kit/  *.tgz  build/
```

### 4.3 创建发版 commit

```powershell
git commit -m "$(cat <<'EOF'
release: vX.Y.Z

- CHANGELOG 详见 CHANGELOG.md [X.Y.Z] 条目
- dist/ 强制提交(发版产物,供大众版 git URL 安装)
EOF
)"
```

### 4.4 打 tag

```powershell
git tag -a vX.Y.Z -m "evorule-console vX.Y.Z"
```

> 用 annotated tag(`-a`),不用 lightweight tag,便于 `git tag -n` 显示发版说明。

---

## 5. 推送到远程

```powershell
# 5.1 推送 commit
git push origin main

# 5.2 推送 tag
git push origin vX.Y.Z
```

**验证**:在 Gitee Web 上确认:

- `main` 分支最新 commit 是发版 commit
- 标签列表出现 `vX.Y.Z`
- 标签 `vX.Y.Z` 指向发版 commit
- `dist/` 目录在 tag 中可见(点进 tag → 文件树,应能看到 `dist/index.js`)

---

## 6. 发版后验证(可选但推荐)

在临时目录验证大众版能经 git URL 安装内核:

```powershell
# 6.1 新建临时 SvelteKit 项目(或在已有大众版仓内)
cd D:\tmp\verify-install
npm init -y
npm install svelte @sveltejs/kit

# 6.2 经 git URL + tag 安装内核
npm install git+https://gitee.com/evo-rule-lab/evorule-console.git#vX.Y.Z

# 6.3 验证导入
node -e "const c = require('@evorule/console'); console.log('version:', c.CONSOLE_VERSION)"
# 期望输出:version: X.Y.Z
```

若导入失败(常见原因:`dist/` 未提交、`exports` 字段配置错误),回滚 tag:

```powershell
# 谨慎:仅当发版 commit 在 push 后 < 1 小时且确认无人拉取时回滚
git tag -d vX.Y.Z
git push origin :refs/tags/vX.Y.Z
# 修复后重新发版(回到步骤 1)
```

---

## 7. 发版后清理

- [ ] 删除本地 `dist/`(可选,因 `.gitignore` 已忽略,不影响后续 commit)
- [ ] 在大众版仓的 `package.json` 中更新依赖版本:`"@evorule/console": "git+https://gitee.com/evo-rule-lab/evorule-console.git#vX.Y.Z"`
- [ ] 更新大众版 CHANGELOG,记录依赖内核版本

---

## 附:版本号策略

| 版本类型     | 何时递增                       | 示例                                         |
| ------------ | ------------------------------ | -------------------------------------------- |
| **patch**(Z) | bug 修复、文档、测试改进       | `0.1.0` → `0.1.1`(AssistantProvider 扩展槽)  |
| **minor**(Y) | 新增功能,向后兼容             | `0.1.x` → `0.2.0`(视图新增 / API 扩展)       |
| **major**(X) | breaking change(API 不兼容)  | `0.x.y` → `1.0.0`(稳定 API 冻结)             |

> 大众版 / 高级版通过 `npm install @evorule/console@^0.1` 依赖,允许 patch / minor 自动升级,major 需手动确认。

---

## 附:发版检查清单(打印用)

```
[ ] 0. 前置:分支 main + 工作区干净 + 与 origin 同步
[ ] 1. 版本号四处同步(package.json / CONSOLE_VERSION / README / CHANGELOG)
[ ] 2.1 svelte-check:0 errors / 0 warnings
[ ] 2.2 vitest:全过
[ ] 2.3 playwright:13/13 passed
[ ] 3.1 清理旧 dist/
[ ] 3.2 npm run prepack 产出 dist/
[ ] 3.3 验证 dist/index.js + CONSOLE_VERSION
[ ] 4.1 git add 显式文件 + git add -f dist/
[ ] 4.2 git status 确认无 test-results/.svelte-kit/ 等噪声
[ ] 4.3 发版 commit
[ ] 4.4 annotated tag vX.Y.Z
[ ] 5.1 push main
[ ] 5.2 push tag
[ ] 5.3 Gitee Web 验证 tag + dist/ 可见
[ ] 6.  临时项目验证 git URL 安装(可选)
[ ] 7.  大众版依赖版本更新
```
