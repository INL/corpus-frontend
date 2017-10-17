import {combineReducers} from 'redux';

import {FILE_CHANGED} from './xmlDocument';

//--------
// Actions
//--------

export const XPATH_CALC_BEGIN = 'XPATH_CALC_BEGIN';
export const calculateXpathBegin = (context) => ({
    type: XPATH_CALC_BEGIN,
    
    context
})

export const XPATH_CALC_END = 'XPATH_CALC_END';
export const calculateXpathEnded = (context, result) => ({
    type: XPATH_CALC_END,
    
    context,
    result
})

export const XPATH_CALC_ABORT = 'XPATH_CALC_ABORT';
export const calculateXpathAborted = (context, error) => ({
    type: XPATH_CALC_ABORT,

    context,
    error
})

export const XPATH_RESET = 'XPATH_RESET';
export const resetXpath = () => ({
    type: XPATH_RESET
})

// TODO move this out of this reducer, as we're relying on root state shape because of getState()
// can't use selector either as that just obfuscates the problem,
// as we're still aware of what our root reducer is (to import the selector, we need to know the reducer, which means we are still implicitly aware of any parent state shape)
export const changeXpathConfig = (optionId, documentNode) => (dispatch, getState) => {
    
    console.log("changexpathconfig: option ", optionId);
    
    const {xmlDocument, xpath: {context: oldContext, calculating}} = getState();

    if (calculating) 
        return Promise.reject("Already calculating an xpath");

    // going to dispatch the result and the new context together.
    return Promise
        .resolve(getNewContext(oldContext, optionId, documentNode))
        .then(context => {
            console.log("new context", context);
   
            const expression = generateInternalExpression(context);
            console.log("Generated expression: " + expression);

            dispatch(calculateXpathBegin(context));

            let result = new Set();
            const nodeIterator = xmlDocument.evaluate(expression, xmlDocument, xmlDocument.createNSResolver( xmlDocument.documentElement ), XPathResult.UNORDERED_NODE_ITERATOR_TYPE, null); 
            for (let cur = nodeIterator.iterateNext(); cur != null; cur = nodeIterator.iterateNext()) {
                result.add(cur);
            }

            return {
                context, 
                result
            }
        })
        .then(({context, result}) => dispatch(calculateXpathEnded(context, result)))
        .catch(error => dispatch(calculateXpathAborted(context, error)))
}

//----------
//  Reducers
//----------

// see getNewContext to see how context is actually determined.
// This is split out so that it can be used in a thunk and dispatched together with new xpath selection results
// when they come in.
const context = (state = initialContextState, action) => {
    switch (action.type) {
        case FILE_CHANGED:
        case XPATH_RESET:
        case XPATH_CALC_ABORT:
            return initialContextState;
        case XPATH_CALC_BEGIN: 
        case XPATH_CALC_END: 
            return action.context;
        default: 
            return state;
    }
}

// TODO most actions should only be handled if action.context === current state context 
// in case action was dispatched async in a running calculation/thunk, but actual context has changed again in the meantime.
const calculating = (state = false, action) => {
    switch (action.type) {
        case FILE_CHANGED:
        case XPATH_RESET: 
        case XPATH_CALC_END:
        case XPATH_CALC_ABORT:
            return false;
        case XPATH_CALC_BEGIN:
            return true;
        default: 
            return state;
    }
}

const selectedNodes = (state = new Set(), action) => {
    switch (action.type) {
        case FILE_CHANGED:
        case XPATH_RESET:
        case XPATH_CALC_BEGIN:
        case XPATH_CALC_ABORT:
            return new Set();
        case XPATH_CALC_END:
            return action.result;
        default:
            return state;
    }
}

const error = (state = null, action) => {
    switch (action.type) {
        case FILE_CHANGED:
        case XPATH_RESET:
        case XPATH_CALC_BEGIN:
            return null;
        case XPATH_CALC_ABORT:
            return action.error;
        default:
            return state;
    }
}

//-----------
//  Selectors
//-----------

export const selectors = {
    getInternalExpression: (state) => generateInternalExpression(state.context), // TODO internal+external expression
    getExpression: (state) => generateExpression(state.context),
    isXpathCalculating: (state) => state.calculating,
    getSelectedNodes: (state) => state.selectedNodes,
    hasError: (state) => state.error != null,
    getError: (state) => state.error,
    
    getXpathOptions: (state, documentNode) => { 
        // const {context} = state;
       
        let options = [];
        
        if (documentNode instanceof Element) {
            options.push(
                contextOptions.XPATH_SELECT_NODE_WITH_NAME,
                contextOptions.XPATH_SELECT_ALL_CHILDREN
            );
        }
        
        if (documentNode instanceof Attr) {
            options.push(contextOptions.XPATH_SELECT_NODE_WITH_ATTRIBUTE);
            options.push(contextOptions.XPATH_SELECT_ATTRIBUTE);
            
        }

        if (documentNode instanceof Text) {
            options.push(contextOptions.XPATH_SELECTOR_TEXT)
        }
        
        return options;
    }
}

/*
    node
        all by name
    attribute
        if parent selected: 
            select value of attribute
            select if has attribute with value
        if no parent selected: 
            all nodes with this attribute
            all nodes with this attribute+value
    text
        select text instead of node
*/

//------
//  Util
//------

const contextOptions = {
    XPATH_SELECT_NODE_WITH_NAME: {
        id: 'XPATH_SELECT_NODE_WITH_NAME',
        displayName: "Select all nodes with this name"
    },
    XPATH_SELECT_ALL_CHILDREN: {
        id: 'XPATH_SELECT_NODE_WITH_NAME',
        displayName: "Select all children of this node"
    },
    XPATH_SELECT_ATTRIBUTE: {
        id: 'XPATH_SELECT_ATTRIBUTE',
        displayName: "Select this attribute's value"
    },
    XPATH_SELECT_NODE_WITH_ATTRIBUTE: {
        id: 'XPATH_SELECT_NODE_WITH_ATTRIBUTE',
        displayName: "Select all nodes with this attribute"
    }, 
    XPATH_SELECT_NODE_WITH_ATTRIBUTE_VALUE: {
        id: 'XPATH_SELECT_NODE_WITH_ATTRIBUTE_VALUE',
        displayName: "Select all nodes with this attribute with this value"
    },
    XPATH_SELECTOR_TEXT: {
        id: 'XPATH_SELECTOR_TEXT',
        displayName: "Select text content"
    }
}

const initialContextState = {
    elementName: null,
    attributeName: null,
    attributeValue: null,

    childSelectorType: null, // one of null, text, element, attribute
    childSelector: null, // attributeName in case of type "attribute", element name in case of type "element", might be null for element, in which case, select all children.
}

/*
    node
        all by name
    attribute
        if parent selected: 
            select value of attribute                   
            select if has attribute with value
        if no parent selected: 
            all nodes with this attribute
            all nodes with this attribute+value
    text
        select text instead of node
*/


const getNewContext = (oldContext, option, documentNode) => {
    switch(option) {
        case contextOptions.XPATH_SELECT_NODE_WITH_NAME: {
            return {
                ...initialContextState,
                elementName: documentNode
            }
        }
        case contextOptions.XPATH_SELECT_NODE_WITH_ATTRIBUTE: {
            return {
                ...oldContext,
                attributeName: documentNode,
                attributeValue: null,
            }
        }
        case contextOptions.XPATH_SELECT_NODE_WITH_ATTRIBUTE_VALUE: {
            return {
                ...initialContextState,
                attributeName: documentNode,
                attributeValue: documentNode
            }
        }
        case contextOptions.XPATH_SELECT_ATTRIBUTE: {
            return {
                ...initialContextState,
                elementName: documentNode.ownerElement,
                childSelectorType: "attribute",
                childSelector: documentNode,
            }
        }
        case contextOptions.XPATH_SELECTOR_TEXT: {
            return {
                ...oldContext,
                elementName: documentNode.parentElement,
                childSelectorType: "text",
                childSelector: null
            }
        }
        case contextOptions.XPATH_SELECT_ALL_CHILDREN: {
            return {
                ...oldContext,
                elementName: documentNode,
                attributeName: null,
                attributeValue: null,
                childSelectorType: "element",
                childSelector: null
            }
        }
        default: 
            throw new Error(`Unhandled switch case ${option.id}!`);
    }
}

const generateInternalExpression = (context) => {
    let attributeSelector = null;
    if (context.attributeName) {
        attributeSelector = '@' + context.attributeName.name;
        if (context.attributeValue)
            attributeSelector = attributeSelector + `="${context.attributeValue.value}"`;
    }

    let elementSelector = null;
    if (context.elementName) {
        if (context.elementName.namespaceURI)
            elementSelector = `//*[local-name()="${context.elementName.localName}"${attributeSelector ? "and " + attributeSelector : ""}]`
        else 
            elementSelector = `//${context.elementName.localName}${attributeSelector ? "[" + attributeSelector + "]" : ""}`
    }

    if  (context.childSelectorType === "text")
        return elementSelector + "/text()";
    else if (context.childSelectorType === "element") {
        if (context.childSelector !=  null)
            return elementSelector + "/" + context.childSelector.localName;
        else 
            return elementSelector + "/*";
    }
    else if (context.childSelectorType === "attribute")
        return elementSelector + "/@" + context.childSelector.name;
    else 
        return elementSelector;
}

const generateExpression = (context) => {
    return generateInternalExpression(context); // TODO
}


// const generateInternalExpression = (nodesById, id, isValue) => {
//     const node = nodesById.get(id);
//     const parent = nodesById.get(id.parentNode || id.ownerElement);
//     switch (node.type) {
//         case "text": {
//             return `//*[local-name()="${parent.name}" and namespace-uri()="${parent.documentNode.namespaceURI}"]/text()`;
//         }
//         case "attribute": {
//             if (parent.documentNode.namespaceURI)
//                 return `//*[local-name()="${parent.name}" and namespace-uri()="${parent.documentNode.namespaceURI}"]/@${node.name}`;
//             else 
//                 return `//${parent.name}@${node.name}`
//         }
//         case "element": {
//             if (node.documentNode.namespaceURI)
//                 return `//*[local-name()="${node.name}" and namespace-uri()="${node.documentNode.namespaceURI}"]`;
//             else 
//                 return `//${node.name}`;
//         }
//         default: 
//             throw new Error(`Unsupported node type ${node.type}`);
//     }
// }

// const generateExpression = (nodesById, id, isValue) => {
//     const node = nodesById.get(id);
//     const parent = nodesById.get(node.documentNode.parentNode || node.documentNode.ownerElement);
//     switch (node.type) {
//         case "text": return `.//${parent.name}`;
//         case "attribute": return `.//${parent.name}/@${node.name}`;
//         case "element": return `.//${node.name}`;
//         default: throw new Error(`Unsupported node type ${node.type}`);
//     }
// }


export default combineReducers({
    calculating,
    selectedNodes,
    error,
    context // need to recalculate expression and such based on the context here
})