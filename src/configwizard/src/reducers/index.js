import {combineForms} from 'react-redux-form';

import xmlDocument from './xmlDocument';
import xpath, {selectors as xpathSelectors} from './xpath';
import rootNodeId from './rootNodeId';
import nodesById from './nodesById';
import xpathModal, {selectors as xpathModalSelectors} from './ui/xpathModal';
import xpathDropdown, {selectors as xpathDropdownSelectors} from './ui/xpathDropdown';

//---------
//  Reducer
//---------

const REDUCER_FORMS_KEY = "forms";
const formReducer = combineForms({
    configForm: {}
}, REDUCER_FORMS_KEY)
export default (state = {}, action) => ({
    xmlDocument: xmlDocument(state.xmlDocument, action),
    xpath: xpath(state.xpath, action),
    rootNodeId: rootNodeId(state.rootNodeId, action, state.xmlDocument),
    nodesById: nodesById(state.nodesById, action, state.xmlDocument),
    xpathModal: xpathModal(state.xpathModal, action),
    xpathDropdown: xpathDropdown(state.xpathDropdown, action),
    
    [REDUCER_FORMS_KEY]: formReducer(state[REDUCER_FORMS_KEY], action)
})

//-----------
//  Selectors
//-----------

export const selectors = {
    getNode: (state, id) => state.nodesById.get(id),
    getXmlDocument: (state) => state.xmlDocument,
    getRootNodeId: (state) => state.rootNodeId,
    isNodeHighlighted:      (state, nodeId) => xpathSelectors.getSelectedNodes(state.xpath).has(nodeId),
    getXpathExpression:     (state) => xpathSelectors.getExpression(state.xpath),
    getXpathDropdownOptions:    (state, nodeId) => xpathSelectors.getXpathOptions(state.xpath, state.nodesById.get(nodeId).documentNode),
    
    isXpathModalShown:      (state) => xpathModalSelectors.isModalShown(state.xpathModal),
    getXpathModalTarget:    (state) => xpathModalSelectors.getModalTarget(state.xpathModal),
    
    isXpathDropdownShown:       (state) => xpathDropdownSelectors.isDropdownShown(state.xpathDropdown),
    getXpathDropdownPosition:   (state) => xpathDropdownSelectors.getDropdownPosition(state.xpathDropdown),
    getXpathDropdownTargetNode: (state) => xpathDropdownSelectors.getDropdownTargetNode(state.xpathDropdown)
}

//------
//  Util
//------

export const withLogging = (reducer) => {
    return (state, action) => {
        console.group(action.type);
        console.log('action', action);
        const returnValue = reducer(state, action);
        console.log('new state', returnValue);
        console.groupEnd(action.type);
        return returnValue;
    }
}
