/**
 * 创建滑块
 * @param {{facts: Array, maxVersion: number, selected: number, onSelect: (v: number) => void}} opts
 * @returns {{el: HTMLElement, setSelected: (v: number) => void}}
 */
export function createSlider({ facts, maxVersion, selected, onSelect }: {
    facts: any[];
    maxVersion: number;
    selected: number;
    onSelect: (v: number) => void;
}): {
    el: HTMLElement;
    setSelected: (v: number) => void;
};
