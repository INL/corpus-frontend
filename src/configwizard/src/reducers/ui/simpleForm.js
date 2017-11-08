import * as HOCForm from '../creators/form';
import xpathContext, {selectors as xpathContextSelectors, updateXpathContext as _updateXpathContext} from '../ui/xpathContext';

const FORM_SET_VALUE = 'FORM_SET_VALUE';
const _setValue = (value) => ({
    type: FORM_SET_VALUE,

    value
});

const FORM_FIELD_INITIALIZE = 'FORM_FIELD_INITIALIZE';
const _initializeField = (descriptor) => ({
    type: FORM_FIELD_INITIALIZE,

    descriptor
})

const initialState = {
    value: null,
    descriptor: null,
    xpathContext: xpathContext(undefined, {}),
}

const simpleForm = (state = initialState, action) => {
    switch (action.type) {
        case FORM_FIELD_INITIALIZE: {
            return {
                ...initialState,
                descriptor: action.descriptor
            }
        }
        case FORM_SET_VALUE: {
            return {
                ...state,
                value: action.value
            }
        }   
        default: {
            const curContextState = state.xpathContext;
            const newContextState = xpathContext(curContextState, action);
            if (curContextState === newContextState)
                return state;    
            
            return {
                    ...state,
                    xpathContext: newContextState
                }
        }
    }
}

// Get the state at the model path and call the reducer with it instead of with the top-level state
const wrapSelector = (selector) => (state, model, ...selectorArguments) => selector(HOCForm.selectors.getValue(state, model), ...selectorArguments)

// Resolve the expression by traversing all the parents.
// intentionally not wrapped, since we operate on the entire state slice instead of just the portion under the model.
const getInternalExpression = (state, model) => {
    const subExpressions = [];

    let curModel = model;
    while (true) {
        let curDesc = getDescriptor(state, curModel);
        const curContext = getContext(state, curModel);
        if (curContext.type != null)
            subExpressions.push(getInternalSubExpression(state, curModel));

        // resolve parent
        if (curDesc.parent != null) {
            let path = curModel.split('.');
            path.pop(); // remove self
            curDesc.parent.forEach(level => level === ".." ? path.pop() : path.push(level));

            curModel = path.join(".");
        }
        else { // no more parents, we're done.
            break;
        }
    }

    return "//" + subExpressions.filter(ex => ex.length !== 0).reverse().join("//"); 
}

// all of these selectors follow the signature of (state, model, ...)
const getValue = wrapSelector(state => {
    // state is now the state at the model path 
    // this may be an array containing objects, undefined (if not initialized yet), or an object as defined by the reducer above
    // if it's an array, return the array, if it's an object, return the .value property, else return undefined.
    if (state instanceof Array)
        return state;
    else 
        return state ? state.value : undefined;
});
const getDescriptor = wrapSelector(state => state && state.descriptor);
const getContext = wrapSelector(state => state && state.xpathContext);
const getExpression = wrapSelector(state => xpathContextSelectors.getExpression(state.xpathContext))
const getInternalSubExpression = wrapSelector(state => xpathContextSelectors.getInternalExpression(state.xpathContext)); // Returns the internal expression for only this portion of the context
const getXpathOptions = wrapSelector((state, nodeType) => xpathContextSelectors.getXpathOptions(state.xpathContext, state.descriptor.xpathType, nodeType))

export const selectors = {
    getValue,
    getDescriptor,
    getExpression,
    getInternalSubExpression,
    getInternalExpression,
    getXpathOptions
}

// All of these have the signature (model, ...)
export const createField = HOCForm.createField("simple");
export const removeField = HOCForm.removeField("simple");
export const setValue = HOCForm.createWrappedAction(_setValue, "simple");
export const initializeField = HOCForm.createWrappedAction(_initializeField, "simple");
export const updateXpathContext = HOCForm.createWrappedAction(_updateXpathContext, "simple");

export default HOCForm.default(simpleForm, "simple");


