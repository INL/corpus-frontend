export const XPATH_CONTEXT_UPDATE = 'XPATH_CONTEXT_UPDATE';
export const updateXpathContext = (option, node) => ({
    type: XPATH_CONTEXT_UPDATE,

    option,
    node
})

const initialState = {
    type: null, // one of "element", "attribute", "elementValue", "attributeValue", this is needed to know how to convert into an expression
    name: null, // string name of the attribute/element, never null if type === "element" or "attribute", might be wildcard

    // Following properties only applicable when type === "element", they're additional selectors on top of the name
    attributeName: null, // never null if attributevalue is also set, might be wildcard
    attributeValue: null,  // might be null when value isn't important
    namespace: null,
}

export default (state = initialState, action) => {
    switch (action.type) {
        case XPATH_CONTEXT_UPDATE: {
            return getNewContext(state, action.option, action.node)
        }
        default: return state;
    }
}

export const selectors = {
    getInternalExpression: (state) => generateInternalExpression(state),
    getExpression: (state) => {
        // throw new Error("not implemented");
        return generateInternalExpression(state);
    },
    getXpathOptions: (state, xpathType, nodeType) => {
        // remove all options only applicable to different types of nodes (like select all attributes is not displayed when clicking text content)
        // and something like select all attributes is not displayed when the result of the xpath expression should be text
        return Object.entries(XpathOptions)
        .filter(([key, value]) => value.xpathType === xpathType && value.nodeType === nodeType)
        .map(([key, value]) => value);
    }
}

export const XpathTypes = {
    NODES: 'XPATH_TYPE_NODES',
    VALUES: 'XPATH_TYPE_VALUES'
}

//xpath options are always relative to the parent options, if no parent options then just relative to root (//)
export const XpathOptions = {
    //selecting child nodes
    'NODES_CHILDREN_ALL': {
        displayName: 'NODES_CHILDREN_ALL',
        xpathType: XpathTypes.NODES,
        nodeType: "element"
    },
    'NODES_CHILDREN_NAMED': {
        displayName: 'NODES_CHILDREN_NAMED',
        xpathType: XpathTypes.NODES,
        nodeType: "element"
    },
    
    //selecting child attributes
    'ATTRIBUTES_ALL': {
        displayName: 'ATTRIBUTES_ALL',
        xpathType: XpathTypes.NODES,
        nodeType: "attribute"
    },
    'ATTRIBUTES_NAMED': {
        displayName: 'ATTRIBUTES_NAMED',
        xpathType: XpathTypes.NODES,
        nodeType: "attribute"
    },

    //add selector where selected nodes must also have an attribute with the following properties
    'REFINE_ATTRIBUTE_NAME': {
        displayName: 'REFINE_ATTRIBUTE_NAME',
        xpathType: XpathTypes.NODES,
        nodeType: "attribute"
    },
    'REFINE_ATTRIBUTE_VALUE': {
        displayName: 'REFINE_ATTRIBUTE_VALUE',
        xpathType: XpathTypes.NODES,
        nodeType: "attribute"
    },
    'REFINE_ATTRIBUTE_NAME_VALUE': {
        displayName: 'REFINE_ATTRIBUTE_NAME_VALUE',
        xpathType: XpathTypes.NODES,
        nodeType: "attribute"
    },

    //select the text contained within a node or attribute, or select the name of the node/attribute (useful when parent seelctor is wildcard)
    'VALUE_NODE_NAME': {
        displayName: 'VALUE_NODE_NAME',
        xpathType: XpathTypes.VALUES,
        nodeType: "element"
    },
    'VALUE_NODE_TEXT': {
        displayName: 'VALUE_NODE_TEXT',
        xpathType: XpathTypes.VALUES,
        nodeType: "text"
    },
    'VALUE_ATTRIBUTE_NAME': {
        displayName: 'VALUE_ATTRIBUTE_NAME',
        xpathType: XpathTypes.VALUES,
        nodeType: "attribute"
    },
    'VALUE_ATTRIBUTE_TEXT': {
        displayName: 'VALUE_ATTRIBUTE_TEXT',
        xpathType: XpathTypes.VALUES,
        nodeType: "attribute"
    },
}

const getNewContext = (context, option, node) => {
    switch (option) {
        case XpathOptions.NODES_CHILDREN_ALL: 
        case XpathOptions.NODES_CHILDREN_NAMED: {
            return {
                name: option === XpathOptions.NODES_CHILDREN_NAMED ? node.nodeName: '*',
                type: 'element',
                attributeName: null,
                attributeValue: null,
                namespace: null
            }
        }
        case XpathOptions.ATTRIBUTES_ALL:
        case XpathOptions.ATTRIBUTES_NAMED: {
            return {
                name: option === XpathOptions.ATTRIBUTES_NAMED ? node.name : '*',
                type: 'attribute',

                // NOTE; these are only valid as subselectors on elements, such as //text[@attribute="value"]
                // when selecting an attribute, the parent selector already specifies the //nodeName, and this just specifies the '/@attribute' that follows.
                attributeName: null,
                attributeValue: null,
                namespace: null,
            }
        } 
        case XpathOptions.REFINE_ATTRIBUTE_NAME:
        case XpathOptions.REFINE_ATTRIBUTE_VALUE: 
        case XpathOptions.REFINE_ATTRIBUTE_NAME_VALUE: {
            
            // If this happens we're trying to create an xpath expression like @attribute[@attribute="test"] which makes no sense.
            if (context.type !== 'element')
                throw new Error("Attempting to filter by attribute properties, is only available for elements");
            
            return {
                ...context,

                attributeName: option === XpathOptions.REFINE_ATTRIBUTE_VALUE ? '*' : node.name, // don't set name if we're only selecting based on the attribute's value
                attributeValue: option === XpathOptions.REFINE_ATTRIBUTE_NAME ? null : node.value, // don't set value if only selecting based on the attribute's name
                namespace: null
            }
        }
        // would need parent context here to determine if valid.
        // if parent context does not have matching type then we can't operate, 
        // as we're trying to select the name/value of an attribute when we have a set of elements instead of attributes or vice versa
        case XpathOptions.VALUE_ATTRIBUTE_NAME: 
        case XpathOptions.VALUE_ATTRIBUTE_TEXT:
        {
            return {
                type: 'attributeValue',
                select: option === XpathOptions.VALUE_ATTRIBUTE_NAME ? 'name' : 'value'
            } 
        }
        case XpathOptions.VALUE_NODE_NAME: 
        case XpathOptions.VALUE_NODE_TEXT: {
            return {
                type: 'elementValue',
                select: option === XpathOptions.VALUE_ATTRIBUTE_NAME ? 'name' : 'value'
            }
        }
        default:
            throw new Error("Unhandled xpath update action");
    }
}

const generateInternalExpression = (contextPart) => {
    switch(contextPart.type) {
        case "element": {
            const expressionParts = [];
            if (contextPart.name !== "*")
                expressionParts.push(`local-name()="${contextPart.name}"`);
            
            if (contextPart.attributeValue)
                expressionParts.push(`@${contextPart.attributeName}="${contextPart.attributeValue}"`);
            else if (contextPart.attributeName && contextPart.attributeName !== "*")
                expressionParts.push(`@${contextPart.attributeName}`);

            return expressionParts.length ? `*[${expressionParts.join(" and ")}]` : '*';
        }
        case "attribute": {
            return `@${contextPart.name}`;
        }
        // selectors are correct, but for internal use, we don't resolve into values, just node sets
        // so omit this selector completely
        // for external use we'd need to output these values. 
        // so TODO split into internal/external xpath expression.
        case "elementValue": {
            // return contextPart.select === "name" ? '/local-name()' : '/text()'
            return "";
        }
        case "attributeValue": {
            // return contextPart.select === "name" ? '/local-name()' : '/string()';
            return "";
        }
        default:
            throw new Error("Unhandled context type " + contextPart.type);
    }
}
