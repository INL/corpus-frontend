import KeyedReducer from './creators/KeyedReducer';

import {FILE_CHANGED} from './xmlDocument';

export const NODES_PARSED = 'NODES_PARSED';
export const nodesParsed = (xmlDocument, ...nodes) => ({
    type: NODES_PARSED,

    xmlDocument,
    nodes
})

export const NODE_EXPAND = 'NODE_EXPAND';
export const setNodeExpanded = (nodeId, expanded) => ({
    type: NODE_EXPAND,
    
    nodeId,
    expanded
})

export const NODE_MORE_CHILDREN = 'NODE_MORE_CHILDREN';
export const showMoreChildren = (nodeId) => ({
    type: NODE_MORE_CHILDREN,

    nodeId,
})

// The core node reducer
// see parseNode in logic/index.js for the exact node structure.
let node = (state, action) => {
    switch (action.type) {
        case NODE_EXPAND:
            return {
                ...state,
                expanded: action.expanded,
            }
        case NODE_MORE_CHILDREN:
            return {
                ...state,
                shownChildren: state.shownChildren + 5
            }
        default:
            return state;
    }
}
// nodes are kept in a map, the node an action targets is determined by the nodeId property of the action.
node = KeyedReducer(node, "nodeId");

// Finally, that map is wrapped and cleared/filled on some specific actions.
export default (state = new Map(), action, xmlDocument) => {
    switch (action.type) {
        case FILE_CHANGED:
            return new Map();
        case NODES_PARSED: {
            if (action.xmlDocument === xmlDocument) {
                return action.nodes.reduce((acc, node) => acc.set(node.id, node), new Map(state));
            }
            else {
                return state;
            }
        }
        default: return node(state, action);
    }
}