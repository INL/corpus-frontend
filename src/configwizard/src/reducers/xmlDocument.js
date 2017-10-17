export const FILE_CHANGED = 'FILE_CHANGED';
export const changeFile = (file) => ({
    type: FILE_CHANGED,
    
    file,
})

export const DOCUMENT_PARSE_BEGIN = 'DOCUMENT_PARSE_BEGIN';
export const documentParseBegin = (file) => ({
    type: DOCUMENT_PARSE_BEGIN,
    
    file,
})

export const DOCUMENT_PARSE_END = 'DOCUMENT_PARSE_END';
export const documentParseEnd = (file, xmlDocument) => ({
    type: DOCUMENT_PARSE_END,
    
    file,
    xmlDocument
})

export const DOCUMENT_PARSE_ABORT = 'DOCUMENT_PARSE_ABORT';
export const documentParseAbort = (file, error) => ({
    type: DOCUMENT_PARSE_ABORT,

    file,
    error
})

export default (state = null, action) => {
    switch(action.type) {
        case FILE_CHANGED: 
        case DOCUMENT_PARSE_BEGIN:
        case DOCUMENT_PARSE_ABORT: 
            return null;
        case DOCUMENT_PARSE_END: 
            return action.xmlDocument;
        default: 
            return state;
    }
}