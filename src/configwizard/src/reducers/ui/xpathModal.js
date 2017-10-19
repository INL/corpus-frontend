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

export default (state = null, action) => {
    switch (action.type) {
        case MODAL_OPEN:
            return action.target;
        case MODAL_CLOSE: 
            return null;
        default:
            return state;
    }
}

const selectors = {
    isModalShown: (state) => state != null,
    getModalTarget: (state) => state
}

export {selectors};
