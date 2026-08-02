// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 EvoRule Project
// evorule-console AssistantProvider 扩展槽 — LLM 辅助接口
//
// 依据: docs/MASS_EDITION.md §2.2.1
// 设计:
//   - evorule-console 自身不引入任何 LLM 依赖(无 openai/无 fetch LLM 代码)
//   - AssistantProvider 是空的扩展槽(默认 null),如同 ExecutionBackend 接口
//     只定义不实现网络版
//   - 大众版注入 CloudLlmAssistant 实现后,视图的 LLM 按钮才渲染
//   - LLM 只生成草案,最终规则是用户审核的 JSON(规则即数据),不破坏
//     "无智能只有执行"基调
export {};
