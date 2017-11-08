export const MODAL_OPEN = 'MODAL_OPEN';
export const openModal = (target, targetDescriptor) => ({
    type: MODAL_OPEN,

    target,
    descriptor: targetDescriptor
})

export const MODAL_CLOSE = 'MODAL_CLOSE';
export const closeModal = () => ({
    type: MODAL_CLOSE,
})

export default (state = {}, action) => {
    switch (action.type) {
        case MODAL_OPEN:
            return {
                ...state,
                target: action.target,
                descriptor: action.descriptor
            }
        case MODAL_CLOSE: 
            return {};
        default:
            return state;
    }
}

const selectors = {
    isModalShown: (state) => state.target != null,
    getModalTarget: (state) => state.target,
    getModalTargetDescriptor: (state) => state.descriptor
}

export {selectors};
