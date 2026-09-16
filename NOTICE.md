<!--
  Copyright 2026 EvoRule Project

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU Affero General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU Affero General Public License for more details.

  You should have received a copy of the GNU Affero General Public License
  along with this program.  If not, see <https://www.gnu.org/licenses/>.

  SPDX-License-Identifier: AGPL-3.0-or-later
-->

# evorule-console — 声明

**版权所有 (c) 2026 EvoRule Project**

本仓库包含由 EvoRule Project 开发的 evorule-console 软件(规则引擎面板内核)。

## 许可

| 资产                     | 协议              | 说明                                                                  |
| ------------------------ | ----------------- | --------------------------------------------------------------------- |
| **evorule-console 代码** | AGPL-3.0-or-later | 详见 [LICENSE](LICENSE);商业许可见 [DUAL_LICENSE.md](DUAL_LICENSE.md) |

evorule-console 全部代码资产统一采用 AGPL-3.0-or-later,可通过商业许可豁免(详见 [DUAL_LICENSE.md](DUAL_LICENSE.md))。

## 与 evorule 核心的关系

evorule-console 在运行时通过抽象"执行后端"接口消费 evorule 核心的能力(详见 [docs/BOUNDARY.md](docs/BOUNDARY.md))。evorule-console 本身不包含、不复用 evorule 核心的代码,二者各自独立建仓、独立许可、独立版本。

## 设计原则

evorule-console 遵循 EvoRule 项目的核心设计原则:

- 规则即数据(可读、可审计、可序列化)
- 自解释引擎(前端只展示,执行在后端,0 依赖可信)
- 完全可追溯(每次状态变化留下因果链)
- 零隐藏逻辑(规则用 JSON 表达,可读可审计)
- 不可变状态(基于不可变数据结构)
- 确定性执行(相同输入 = 永远相同输出)

## 联系信息

- **项目**: evorule-console — evorule 规则引擎面板内核
- **作者**: EvoRule Project
- **邮箱**: <evorulelab@gmail.com>
- **组织**: [EvoRule](https://gitee.com/evorule)
- **Gitee**: <https://gitee.com/evorule/evorule-console>
