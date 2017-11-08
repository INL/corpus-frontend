import {nodesParsed} from '../reducers/nodesById';
import {rootNodeParsed} from '../reducers/rootNodeId';

import {selectors} from '../reducers/';

import {changeFile, documentParseBegin, documentParseEnd, documentParseAbort} from '../reducers/xmlDocument';
import {closeModal, openModal} from '../reducers/ui/xpathModal';

import * as xpath from '../reducers/xpath';
import {updateXpathContext, setValue} from '../reducers/ui/simpleForm';

// import {changeConfigFormField} from '../reducers';

export const parseRoot = (xmlDocument) => (dispatch) => {
    const rootNode = parseNode(xmlDocument, null); //get the node's own info
    
    return Promise.resolve().then(() => {
        if (rootNode != null) {
            // add the root node to the store
            // so we can use it in parseVisibleNodes
            // but don't set it as a rootNode yet! we'll need its children to be parsed
            // on first render.
            dispatch(nodesParsed(xmlDocument, rootNode)); 
            return rootNode;
        } else {
            return Promise.reject();
        }
    })
    .then(rootNode => dispatch(parseVisibleNodes(rootNode.id))) // now parse the children
    .then(visibleNodes => dispatch(rootNodeParsed(xmlDocument, rootNode))) // finally set the root node
}

// TODO name this
/**
 * create and parse children for these nodes
 * @param {*} nodeIds 
 * @return {Promise<Node[][], String>}
 */
export const parseVisibleNodes = (...nodeIds) => (dispatch, getState) => {
    
    // memoize state, since we're going to be doing stuff async
    const state = getState();
    let promises = nodeIds.map(id => {
        const parentNode = selectors.getNode(state, id);
        if (parentNode.childIds != null)
            return Promise.resolve([]); // already parsed, resolve an array for parity with the data when we actually parse something
        
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                // console.log(node);
                // const now = new Date().getTime();
                // while(new Date().getTime() < now + 500){ /* do nothing */ } 
            
                // console.log("inside timeout!");

                let copy = Object.assign({}, parentNode);
                copy.childIds = [];
                copy.attributeIds = [];
                let newNodes = [copy]; // since we will be updating the parentNode('s children) we need to re-add with the new changes.
                
                Array.prototype.forEach.call(parentNode.documentNode.childNodes, (childNode) => {
                    let parsedNode = parseNode(childNode, parentNode.id);
                    if (parsedNode != null) {
                        copy.childIds.push(parsedNode.id);
                        newNodes.push(parsedNode);
                    }
                })
                Array.prototype.forEach.call(parentNode.documentNode.attributes || [], (attributeNode) => {
                    let parsedNode = parseNode(attributeNode, parentNode.id);
                    if (parsedNode != null) {
                        copy.attributeIds.push(parsedNode.id);
                        newNodes.push(parsedNode);
                    }

                })
                dispatch(nodesParsed(selectors.getXmlDocument(state), ...newNodes));
                resolve(newNodes);
            }, 1);
        })
    });

    // this will resolve when all promises in the array have resolved, 
    // returning an array of arrays, one per id passed in, containing the updated and new nodes.
    return Promise.all(promises);
}

export const parseNode = (documentNode, parentNodeId) => {
    
    let type = null;
    let name = null;
    let data = null;

    // Don't use nodeType, it will break for attributes in DOM4 
    if (documentNode instanceof Attr) {
        type = 'attribute';
        name = documentNode.nodeName;
        data = documentNode.nodeValue;
    } else if (documentNode instanceof Text) { 
        type = 'text';
        data = documentNode.data && documentNode.data.trim();
        if (data === "")
            return null; // ignore this node, it's just whitespace from the document layout
    } else if (documentNode instanceof Element || documentNode instanceof Document) {
        type = 'element';
        name = documentNode.nodeName;
    } else  {
        return null;
    }

    return {
        id: documentNode,
        documentNode,
        type,
        name,
        data,

        attributeIds: null,
        childIds: null,
        parentNodeId,
        
        shownChildren: 20,
        expanded: false
    }
}

export const changeAndParseFile = (file) => (dispatch) => {
    dispatch(changeFile(file));
    if (file == null)
        return Promise.resolve();
    
    return new Promise((resolve, reject) => {
        dispatch(documentParseBegin(file));
        
        const fr = new FileReader();
        fr.onload = function() {
            const parser = new DOMParser();                
            const xmlDocument = parser.parseFromString(fr.result,"text/xml");
            if (xmlDocument != null)
                return resolve(xmlDocument);
            else
                return reject("Error parsing file");
        }
        fr.readAsText(file);
    }).then(xmlDocument => {
        dispatch(documentParseEnd(file, xmlDocument));
        dispatch(parseRoot(xmlDocument));
    }).catch(error => {
        dispatch(documentParseAbort(file, error));
    })
}

export const setConfigFormFieldAndCloseModal = () => (dispatch, getState) => {
    // Keep reference to original state
    const state = getState();
    const model = selectors.getXpathModalTarget(state);
    const expression = selectors.getXpathExpression(state, model);
    
    dispatch(closeModal());
    dispatch(setValue(model, expression));
}

export const changeXpathConfigAndRecalculateXpath = (option, nodeId) => (dispatch, getState) => {
    const state = getState();

    const model = selectors.getXpathModalTarget(state);

    dispatch(updateXpathContext(model, option, nodeId));
    dispatch(recalculateXpath());
}

export const openModalAndRefreshXpath = (model) => (dispatch, getState) => {
    dispatch(openModal(model));
    dispatch(recalculateXpath());
}

export const recalculateXpath = () => (dispatch, getState) => {
    const state = getState();
    const model = selectors.getXpathModalTarget(state);
    const expression = selectors.getInternalXpathExpression(state, model);
    // TODO compare with current expression to see if recalc is required.
    const xmlDocument = selectors.getXmlDocument(state);
    
    return Promise.resolve()
        .then(() => {
            dispatch(xpath.calculateXpathBegin(expression));

            let result = new Set();
            const nodeIterator = xmlDocument.evaluate(expression, xmlDocument, xmlDocument.createNSResolver( xmlDocument.documentElement ), XPathResult.UNORDERED_NODE_ITERATOR_TYPE, null); 
            for (let cur = nodeIterator.iterateNext(); cur != null; cur = nodeIterator.iterateNext()) {
                result.add(cur);
            }

            return result;
        })
        .then((result) => dispatch(xpath.calculateXpathEnded(expression, result)))
        .catch((error) => dispatch(xpath.calculateXpathAborted(expression, error)));
}