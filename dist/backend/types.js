// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 EvoRule Project
// evorule-console 执行后端 — 数据契约 + ExecutionBackend 抽象接口
//
// 依据: docs/SPEC.md §1
// 设计原则: evorule-console 只依赖此抽象接口,不绑定 HTTP / Tauri / WASM。
//   - 大众版提供 HttpBackend 实现(本目录 http-backend.ts)
//   - 高级版提供 EmbeddedBackend 实现(Tauri + Rust link evorule crate)
//
// 端点对齐来源:
//   - time-travel-debugger/src/core/api.js (v1.0,49/51 PASS)
//   - src/lib/api/evorule-server.js (旧只读 client)
export {};
