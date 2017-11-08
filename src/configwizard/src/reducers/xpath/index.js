import {combineReducers} from 'redux';

import {FILE_CHANGED} from '../xmlDocument';

//--------
// Actions
//--------

export const XPATH_CALC_BEGIN = 'XPATH_CALC_BEGIN';
export const calculateXpathBegin = (expression) => ({
    type: XPATH_CALC_BEGIN,
    
    expression
})

export const XPATH_CALC_END = 'XPATH_CALC_END';
export const calculateXpathEnded = (expression, result) => ({
    type: XPATH_CALC_END,
    
    expression,
    result
})

export const XPATH_CALC_ABORT = 'XPATH_CALC_ABORT';
export const calculateXpathAborted = (expression, error) => ({
    type: XPATH_CALC_ABORT,

    expression,
    error
})

export const XPATH_RESET = 'XPATH_RESET';
export const resetXpath = () => ({
    type: XPATH_RESET
})

//----------
//  Reducers
//----------

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

const expression = (state = null, action) => {
    switch (action.type) {
        case FILE_CHANGED: 
        case XPATH_RESET:
            return null;
        case XPATH_CALC_BEGIN:
            return action.expression;
        case XPATH_CALC_ABORT:
        case XPATH_CALC_END:
        default:
            return state;
    }
}

export default combineReducers({
    calculating,
    selectedNodes,
    error,
    expression,
})

//-----------
//  Selectors
//-----------

export const selectors = {
    isXpathCalculating: (state) => state.calculating,
    getSelectedNodes: (state) => state.selectedNodes,
    hasError: (state) => state.error != null,
    getError: (state) => state.error,
    getExpression: (state) => state.expression
}
