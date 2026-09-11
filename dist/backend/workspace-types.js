// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 EvoRule Project
// evorule-console workspace 后端 — 数据契约 + WorkspaceBackend 抽象接口
//
// 依据: 设计文档/00_架构边界原则.md §1.2(server 公共层接口)
//       实施文档_界面升级_v1.0.md §C.1
// 对齐来源: evorule-server core/workspace/src/models.rs(权威模型)
//           evorule-server core/workspace/src/api.rs(权威路由)
//           evorule-server core/workspace/src/rule_translate.rs(转译契约)
//           evorule-server core/workspace/src/verdict_service.rs(判定契约)
//
// 设计原则: 与 ExecutionBackend(types.ts) 并列的第二个后端抽象。
//   - ExecutionBackend: evorule 核心执行态(会话/命令/审计/时间旅行),15 方法
//   - WorkspaceBackend: server 应用层 workspace 能力(规则/沙盒/发布/判定/转译/旁路),~35 方法
//   两者并列,各自独立 context 注入,均不绑定 HTTP/TAuri/WASM 实现。
export {};
