import JsonNode from "./JsonNode.svelte";
interface Props {
    data: unknown;
    level?: number;
    key?: string;
}
declare const JsonNode: import("svelte").Component<Props, {}, "">;
type JsonNode = ReturnType<typeof JsonNode>;
export default JsonNode;
