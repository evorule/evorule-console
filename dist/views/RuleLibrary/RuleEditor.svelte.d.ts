interface Props {
    mode: "create" | "edit";
    ruleId: string | null;
    initialContent: string;
    onsave: (content: string, description: string, version: number) => void;
    oncancel: () => void;
}
declare const RuleEditor: import("svelte").Component<Props, {}, "">;
type RuleEditor = ReturnType<typeof RuleEditor>;
export default RuleEditor;
