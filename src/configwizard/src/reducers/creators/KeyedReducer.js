
/*
    reducer = KeyedReducer(reducer, 'keyName', INITIALIZE_ACTION, DELETE_ACTION)
    listens to all actions with a property [keyName], gets the state under the key by that value, and passes on that state, along with the action to the wrapped reducer.
    when no state exists under the specified key, the action is ignored, unless the action was INITIALIZE_ACTION, in which case the underlying reducer is called with the action and a null value.
    on DELETE_ACTION, the state under the provided key is removed.
    if no INITIALIZE_ACTION was provided, the reducer will always be called even when there is no state for the key yet.
*/

/// TODO provide a higher-order action creator that adds the [keyName] property to an action.
export default (reducer, keyName, initializeAction, deleteAction) => {
    return function(state = new Map(), action, ...rest) {
        if (action == null || action[keyName] == null)
            return state;
        
        const key = action[keyName];
        const value = state.get(key);
        switch (action.type) {
            case initializeAction: {
                return new Map(state).set(key, reducer(value, action, ...rest));
            }
            case deleteAction: {
                return new Map(state).delete(key);
            }
            default: {
                return (value != null || initializeAction == null) ? new Map(state).set(key, reducer(value, action, ...rest)) : state;
            }
        }
    }
}