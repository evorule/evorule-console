/**
 * evorule 规则预校验器(L_console 层)
 *
 * 门禁分层(详见 ./GATE_ALIGNMENT.md):
 *   L0 (权威)   — 核心仓 build.rs + clippy + Kani
 *                 扫描 Rust 源码,编译时拦截,最终权威
 *                 位置: 核心仓 evorule-{tcb,reactor,governance,cli}/build.rs
 *                 索引: 核心仓 GATE_REFERENCE.md
 *
 *   L_console    — 本文件 (UX 预校验,非权威)
 *                 扫描 JSON 规则内容,提交前给业务专家即时反馈
 *                 核心仓 build.rs 是最终拦截者,本层只是 UX 反馈
 *
 * evorule-console 基础版无网络,业务专家编辑规则时 evorule-server 不在线,
 * 本地预校验是唯一反馈通道。本层不污染 TCB — 校验在 TS 前端,
 * 核心仓 TCB 仍是确定性执行的最终保证。
 *
 * 检查项(7 条,与核心仓 SPEC 的对齐见每条 G 注释):
 * G1: JSON 格式合法性
 * G2: 元指令类型合法性(set, push, branch, io_request, collect, merge) → 对齐 _shared/v1.0.json transform_rule (6 元指令, 权威源 tcb executor dispatch)
 * G3: I/O 双路径模式(io_request 必须在 exists(__io_result__) 分支内)
 * G4: 域类型合法性(eq, lt, exists, instruction, all, not)     → 对齐 TCB_SPEC.md T2 (6 域类型有限性)
 * G5: 路径引用格式(__ 前缀必须符合 __exec__.payload.xxx)
 * G6: 兜底规则存在(最后一条必须是 all([]))                   → 对齐 TCB_SPEC.md D2 (终止性保证)
 * G7: 递归深度限制(≤ 64 层)                                  → 对齐 TCB_SPEC.md D2 (MAX_BRANCH_DEPTH=64)
 *
 * 同步策略:
 *   - 核心仓 T1/T2/D2 编号变更时,本文件 + GATE_ALIGNMENT.md 必须同步
 *   - L_console 不可能覆盖 L0 全部约束(L0 含 Rust 源码层 23 模式,
 *     那些不适用于 JSON 规则内容)
 *   - 提交规则时,即使 L_console 通过,核心仓 build.rs/executor 仍会做最终拦截
 */
export interface ValidationError {
    gate: string;
    message: string;
    path?: string;
}
export interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
}
export declare class RuleValidator {
    /**
     * LLM 输出前的门禁检查
     */
    static validate(json: string): ValidationResult;
    /**
     * G2: 检查元指令类型(set / push / branch / io_request / collect / merge)
     * 对齐: _shared/v1.0.json transform_rule 6 元指令枚举(权威源 tcb executor dispatch)
     */
    private static checkMetaInstruction;
    /**
     * G3: 检查 I/O 双路径模式
     * io_request 必须在 exists(__io_result__) 分支内
     */
    private static checkIoTwoPhase;
    /**
     * G4: 检查域类型合法性(eq / lt / exists / instruction / all / not)
     * 对齐: TCB_SPEC.md §一 T2 (6 域类型, 域类型有限性 = 确定性来源)
     */
    private static checkDomainTypes;
    /**
     * G5: 检查路径引用格式
     *
     * 白名单 (与 server rule_translate.rs check_path_references 对齐):
     *   - __exec__.payload.*     输入数据
     *   - __exec__.instruction.* 当前指令参数
     *   - __exec__.queue         队列引用
     *   - __exec__.result.*      规则输出标记 (业务动作 notify/approve/flag)
     *   - __io_result__          IO 结果
     */
    private static checkPathReferences;
    /**
     * G6: 检查兜底规则存在(末条必须是 branch + all([]))
     * 对齐: TCB_SPEC.md §四 D2 (终止性保证, 兜底规则确保未匹配指令有归宿)
     */
    private static checkFallbackRule;
    /**
     * G7: 检查递归深度限制(≤ 64 层)
     * 对齐: TCB_SPEC.md §四 D2 (MAX_BRANCH_DEPTH = 64 / MAX_DOMAIN_DEPTH = 64, 终止性保证)
     */
    private static checkRecursionDepth;
}
