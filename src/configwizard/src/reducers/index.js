// import {combineForms} from 'react-redux-form';

import simpleForm, {selectors as formSelectors} from './ui/simpleForm';
import xmlDocument from './xmlDocument';
import xpath, {selectors as xpathSelectors} from './xpath';
import rootNodeId from './rootNodeId';
import nodesById from './nodesById';
import xpathModal, {selectors as xpathModalSelectors} from './ui/xpathModal';
import xpathDropdown, {selectors as xpathDropdownSelectors} from './ui/xpathDropdown';

//---------
//  Reducer
//---------

export default (state = {}, action) => ({
    xmlDocument: xmlDocument(state.xmlDocument, action),
    xpath: xpath(state.xpath, action),
    rootNodeId: rootNodeId(state.rootNodeId, action, state.xmlDocument),
    nodesById: nodesById(state.nodesById, action, state.xmlDocument),
    xpathModal: xpathModal(state.xpathModal, action),
    xpathDropdown: xpathDropdown(state.xpathDropdown, action), 
    simpleForm: simpleForm(state.simpleForm, action)
})

//-----------
//  Selectors
//-----------

const selectors1 = {
    getNode: (state, nodeId) => state.nodesById.get(nodeId),
    getXmlDocument: (state) => state.xmlDocument,
    getRootNodeId: (state) => state.rootNodeId,

    isNodeHighlighted:      (state, nodeId) => xpathSelectors.getSelectedNodes(state.xpath).has(nodeId),
    isXpathCalculating: (state) => xpathSelectors.isXpathCalculating(state.xpath),    

    isXpathModalShown:      (state) => xpathModalSelectors.isModalShown(state.xpathModal),
    getXpathModalTarget:    (state) => xpathModalSelectors.getModalTarget(state.xpathModal),
    getXpathModalTargetDescriptor: (state) => xpathModalSelectors.getModalTargetDescriptor(state.xpathModal),
    
    isXpathDropdownShown:       (state) => xpathDropdownSelectors.isDropdownShown(state.xpathDropdown),
    getXpathDropdownPosition:   (state) => xpathDropdownSelectors.getDropdownPosition(state.xpathDropdown),
    getXpathDropdownTargetNodeId: (state) => xpathDropdownSelectors.getDropdownTargetNodeId(state.xpathDropdown),

    getFormValue: (state, model) => formSelectors.getValue(state.simpleForm, model),
    getFormContext: (state, model) => formSelectors.getContext(state.simpleForm, model),
    getFormDescriptor: (state, model) => formSelectors.getDescriptor(state.simpleForm, model),
    getXpathExpression: (state, model) => formSelectors.getExpression(state.simpleForm, model),
    getInternalXpathExpression: (state, model) => formSelectors.getInternalExpression(state.simpleForm, model)
}

const selectors2 = {
    getXpathDropdownOptions: (state) => {
        if (!selectors1.isXpathDropdownShown(state))
            return [];

        const nodeId = selectors1.getXpathDropdownTargetNodeId(state);
        const fieldModel = selectors1.getXpathModalTarget(state);
        const node = selectors1.getNode(state, nodeId);
        
        // TODO further filter this based on the parent xpathtype (if attribute, only allow value options)
        return formSelectors.getXpathOptions(state.simpleForm, fieldModel, node.type)
    }
}

export const selectors = {
    ...selectors1,
    ...selectors2
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
