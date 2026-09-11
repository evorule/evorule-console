import type { CausalEntry } from "../../backend/types";
interface Props {
    facts: CausalEntry[];
    verified: boolean;
    onfactclick?: (factId: number) => void;
}
declare const FactStream: import("svelte").Component<Props, {}, "">;
type FactStream = ReturnType<typeof FactStream>;
export default FactStream;
