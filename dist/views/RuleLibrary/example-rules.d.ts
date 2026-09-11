/**
 * 内置示例规则的种子数据(仅 content + 元描述)。
 *
 * 种入 workspace 时:
 *   - name 取 BuiltinRuleSeed.name(workspace 内唯一)
 *   - content 直接写入 RuleVersionRecord.content
 *   - metadata 设为 `{readonly:true, builtin:true}` (isReadonly() 据此判定)
 *   - description 透传
 */
export interface BuiltinRuleSeed {
    /** 规则名称(对应 RuleRecord.name,workspace 内唯一) */
    name: string;
    /** 业务专家可读的描述 */
    description: string;
    /** 原始 JSON 文本(规则的 transform 表达) */
    content: string;
}
/**
 * 3 个示例规则,从简到繁展示 evorule 规则即数据的特性。
 *
 * 示例 1(set_basic):最简单的 set 指令
 * 示例 2(branch_vip):条件分支 — VIP 客户打折
 * 示例 3(io_two_phase):IO 双路径 — 库存检查后发通知
 */
export declare const BUILTIN_RULES: BuiltinRuleSeed[];
