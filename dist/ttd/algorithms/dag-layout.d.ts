/**
 * @param {Array} chain - causal chain entries
 * @returns {{nodes: Array, edges: Array, layerCount: number, width: number, height: number}}
 */
export function layoutDag(chain: any[]): {
    nodes: any[];
    edges: any[];
    layerCount: number;
    width: number;
    height: number;
};
export namespace LAYOUT_CONST {
    export { NODE_W };
    export { NODE_H };
    export { LAYER_GAP };
    export { NODE_GAP };
}
declare const NODE_W: 140;
declare const NODE_H: 44;
declare const LAYER_GAP: 60;
declare const NODE_GAP: 30;
export {};
