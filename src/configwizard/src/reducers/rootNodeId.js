import {FILE_CHANGED} from './xmlDocument';

export const NODE_ROOT_PARSED = 'NODE_ROOT_PARSED';
export const rootNodeParsed = (xmlDocument, node) => ({
    type: NODE_ROOT_PARSED,
    
    xmlDocument,
    node
})

export default (state = null, action, xmlDocument) => {
    switch (action.type) {
        case FILE_CHANGED:
            return null;
        case NODE_ROOT_PARSED:
            if (action.xmlDocument === xmlDocument)
                return action.node.id;
            else 
                return state;
        default:
            return state;
    }
}