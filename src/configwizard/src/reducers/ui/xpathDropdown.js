import {FILE_CHANGED} from '../xmlDocument';
import {XPATH_RESET} from '../xpath';

//---------
//  Actions
//---------

export const XPATH_DROPDOWN_OPEN = 'XPATH_DROPDOWN_OPEN';
export const openDropdown = (coordinates, nodeId) => ({
    type: XPATH_DROPDOWN_OPEN,

    coordinates,
    nodeId
})

export const XPATH_DROPDOWN_CLOSE = 'XPATH_DROPDOWN_CLOSE';
export const closeDropdown = () => ({
    type: XPATH_DROPDOWN_CLOSE
})

//---------
//  Reducer
//---------

const initialDropdownState = {
    nodeId: null,
    open: false,
    coordinates: {
        left: "0",
        top: "0",
        right: "auto",
        bottom: "auto"
    }
}

export default (state = initialDropdownState, action) => {
    switch (action.type){
        case FILE_CHANGED:
        case XPATH_RESET:
            return initialDropdownState;
        case XPATH_DROPDOWN_OPEN: {
            return {
                ...state,
                nodeId: action.nodeId,
                coordinates: action.coordinates,
                open:true,
            }
        }
        case XPATH_DROPDOWN_CLOSE: {
            return {
                ...state,
                open: false
            }
        }
        
        default: 
            return state;
    }
}

export const selectors = {
    isDropdownShown: (state) => state.open,
    getDropdownPosition: (state) => state.coordinates,
    getDropdownTargetNode: (state) => state.nodeId,
}