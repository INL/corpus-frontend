import {setWith, get, clone} from 'lodash';

/*
    if we want to support multiple forms next to each other, with custom reducers at the bottom
    we need to have some action that designates that it's for that model
    we can have all action creators be wrapped, since the implementing form knows how to id them
    so that would make it good.

    so then we export an action with an extra "form" key with the form's id or something
    then we have the model which the formitself needs to provide
    then we have the actual action and values, those are just passthrough for our hoc ac

*/

export const FORM_WRAPPED_ACTION = 'FORM_WRAPPED_ACTION';
export const createWrappedAction = (action, formId) => (model, ...remainder) => {
    return {
        type: FORM_WRAPPED_ACTION,
    
        formId,
        model,

        wrappedAction: action.apply(undefined, remainder)
    }
}

export const FORM_ADD_FIELD = 'FORM_ADD_FIELD';
export const createField = (formId) => (model) => ({
    type: FORM_ADD_FIELD,
    
    formId, 
    model
})

export const FORM_REMOVE_FIELD = 'FORM_REMOVE_FIELD';
export const removeField = (formId) => (model) => ({
    type: FORM_REMOVE_FIELD,

    formId,
    model
})


export default (reducer, formId) => (state = {}, action) => {
    if (action.formId !== formId) {
        return state;    
    }
    
    switch (action.type) {
        case FORM_ADD_FIELD: {
            const newFieldsArray = (get(state, action.model) || []).concat({}); // Object as initial value, so subsequent sets on sub-properties will succeed
            return setWith(clone(state), action.model, newFieldsArray, clone);
        }
        case FORM_REMOVE_FIELD: {
            // Required to do in two steps, as splice returns the removed elements, but we want the original array
            const newArrayState = get(state, action.model).concat(); // concat clones the array
            newArrayState.splice(action.index, 1);
            return setWith(clone(state), action.model, newArrayState, clone);
        }
        case FORM_WRAPPED_ACTION: {
            // Retrieve the value for the model, and run the reducer on that value
            // Then place back the modified value (if appropriate)
            const oldState = get(state, action.model);
            const newState = reducer(oldState, action.wrappedAction);
            
            if (oldState !== newState)
                return setWith(clone(state), action.model, newState, clone);
            else 
                return state;
        }
        default: 
            return state;
    }
}

export const selectors = {
    getValue: (state, model) => get(state, model)
}