interface Props {
    kind: 'evorule-error' | 'verdict-pass' | 'verdict-block' | 'verdict-none' | 'chain-verified' | 'chain-broken' | 'metric';
    value?: string;
    showBoundary?: boolean;
    compact?: boolean;
}
declare const VerdictBadge: import("svelte").Component<Props, {}, "">;
type VerdictBadge = ReturnType<typeof VerdictBadge>;
export default VerdictBadge;
