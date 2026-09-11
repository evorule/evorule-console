/** 连接或响应异常（模式对齐 HttpWorkspaceBackendError） */
export declare class PluginPacksError extends Error {
    readonly status: number;
    readonly endpoint: string;
    constructor(message: string, status: number, endpoint: string);
}
/** 双语展示名（R5 纯展示数据,不进事实/命令） */
export type DisplayName = {
    zh?: string;
    en?: string;
} & Record<string, unknown>;
/** GET /api/plugins 元素 */
export interface PluginSummary {
    id: string;
    contract_version: string;
    version: string;
    description: string;
    capabilities: string[];
    assets: {
        scenes: number;
        templates: number;
    };
}
/** 模板表单参数（契约 §4.3 / §4.5 控件词表） */
export interface ParamFieldRaw {
    field_id: string;
    display_name: DisplayName;
    type: 'text' | 'textarea' | 'number' | 'currency' | 'date' | 'boolean' | 'enum' | 'scene_field';
    required?: boolean;
    default?: unknown;
    options?: string[];
    scene_ref?: string;
}
/** 模板资产原值（GET assets/templates 元素） */
export interface TemplateAssetRaw {
    template_id: string;
    display_name: DisplayName;
    description?: string;
    scene_ref?: string;
    params_form: ParamFieldRaw[];
    rule_draft_skeleton: unknown;
}
/** 场景字段（契约 §4.2） */
export interface SceneFieldRaw {
    field_id: string;
    display_name: DisplayName;
    type: string;
    options?: string[];
    path?: string;
    unit?: string;
}
/** 场景资产原值（GET assets/scenes 元素） */
export interface SceneAssetRaw {
    scene_id: string;
    display_name: DisplayName;
    description?: string;
    business_objects: Array<{
        object_id: string;
        display_name: DisplayName;
        fields: SceneFieldRaw[];
    }>;
}
/** POST generate 响应（R3: 仅草稿 + 来源标记,不落库） */
export interface GenerateResult {
    rule_draft: unknown;
    provenance: {
        pack: string;
        pack_version: string;
        template: string;
        contract_version: string;
    };
}
/** 展示名取值:zh 优先,en 兜底,最后回退 id（console 中文 UI） */
export declare function dn(name: DisplayName | undefined, fallback: string): string;
export declare class PluginPacksClient {
    private readonly baseUrl;
    private readonly authToken;
    constructor(baseUrl?: string, authToken?: string | null);
    private headers;
    private fetchJson;
    /** GET /api/plugins — 已注册声明式 pack 清单 */
    listPacks(): Promise<PluginSummary[]>;
    /** GET /api/plugins/{pack_id}/assets/templates — 模板资产原值 */
    getTemplates(packId: string): Promise<TemplateAssetRaw[]>;
    /** GET /api/plugins/{pack_id}/assets/scenes — 场景资产原值 */
    getScenes(packId: string): Promise<SceneAssetRaw[]>;
    /**
     * POST /api/plugins/templates/{pack_id}/{template_id}/generate — 草稿生成。
     * 纯函数面:server 不落库,草稿仅在用户确认后走既有 Draft→Publish 链（R3）。
     * 校验失败 → 400 显式错误（服务端 fail-fast 文案已面向用户,原样抛出）。
     */
    generate(packId: string, templateId: string, form: Record<string, unknown>): Promise<GenerateResult>;
}
