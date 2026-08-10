# 本地字体目录

> **强隐私不联网原则** (实施文档_界面升级_v1.0.md §五 B.1)
>
> evorule-console 绝不从网络加载字体。`src/app.css` 的 `@font-face` 仅用
> `local()` 读取操作系统已安装的字体, 并回退到系统无衬线/等宽字体。
> 因此本目录**默认为空也能正常工作**。

## 完整保真(可选)

若希望在没有安装 Inter / JetBrains Mono 的机器上获得完整字体保真, 可把
对应的 `woff2` 文件放入本目录, 并在 `src/app.css` 的 `@font-face` 中追加
`src: url('./assets/fonts/xxx.woff2')` 行(排在 `local()` 之后)。

字体仍由 console 自身静态托管(`src/lib/assets/`), **不发起任何外部网络请求**。

## 推荐文件

| 字体 | 用途(01 §1.2) | 来源 |
| :--- | :--- | :--- |
| Inter | 正文/标题/按钮 | https://rsms.me/inter/ (SIL OFL) |
| JetBrains Mono | 数值/代码/时间 | https://www.jetbrains.com/lp/mono/ (SIL OFL) |

下载后只需 `Inter-Regular.woff2` / `Inter-SemiBold.woff2` / `JetBrainsMono-Regular.woff2`
即可覆盖 console 全部字重需求。

## 许可

Inter (SIL Open Font License 1.1) / JetBrains Mono (SIL OFL 1.1) 均允许自由再分发。
