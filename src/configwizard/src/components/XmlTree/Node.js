import React from 'react';
import {connect} from 'react-redux';

import NodeProperty from './NodeProperty';

import {showMoreChildren, setNodeExpanded} from '../../reducers/nodesById';
import {parseVisibleNodes} from '../../logic';
import {selectors} from '../../reducers';


const mapStateToProps = (state, ownProps) => {
    const node = selectors.getNode(state, ownProps.nodeId);
    const textOnly = node.childIds && node.childIds.every(id => selectors.getNode(state, id).type === "text");
    
    // TODO reselect to memoize, right now we rerun render logic every time because state !== oldState
    return {
        ...node,
        textOnly,
    }
}

const mapDispatchToProps = (dispatch, ownProps) => ({
    onSetExpanded: (expanded) => dispatch(setNodeExpanded(ownProps.nodeId, expanded)),
    onShowMoreChildren: () => dispatch(showMoreChildren(ownProps.nodeId)),
    lazyLoadChildren: (childIds) => dispatch(parseVisibleNodes(...childIds))
    // ...bindActionCreators({
        //argumentless actioncreators here
    // }, dispatch)
})

// TODO tidy up
// the <node> in the second line can be a text node too, but only when the parent node 
// is not a textOnly node
// this ties in to the type === "text" check in Node
// because that can only ever hit when the parent node is a mixed-content node
// (because otherwise the parentnode will be textonly, and we would only render <NodeProperty> for children)
// this is done to align text in mixed-content nodes with actual full element nodes, the <div> wrapper is required to do that.
const renderChildren = (childIds, textOnly) => {
    if (textOnly) 
        return childIds.map(id => <NodeProperty nodeId={id}/>);    
    else 
        return childIds.map(id => <Node nodeId={id}/>);
}

let Node = ({nodeId, type, attributeIds, childIds, shownChildren, expanded, textOnly, onSetExpanded, onShowMoreChildren, lazyLoadChildren}) => {
    // console.log(`Render for node ${nodeId}`);
    // TODO use componentWillMount() (component class? eck)
    if (expanded || textOnly) {
        lazyLoadChildren(childIds.slice(0, shownChildren));
    }

    // only ever true if parent is mixed-content, see renderChildren
    if (type === "text") {
        return (
            <div className="node">
                <NodeProperty nodeId={nodeId}/>
            </div>
        )
    }

    return (
        <div className="node">
            
            {!textOnly && childIds && childIds.length > 0 && 
            <span className="node-expand" onClick={() => onSetExpanded(!expanded)}>{expanded ? "-" : "+"}</span>}
            
            <NodeProperty nodeId={nodeId}/>
            {attributeIds != null && attributeIds.map(attributeId => <NodeProperty nodeId={attributeId}/>)}

            {(expanded || textOnly) && childIds &&
            renderChildren(childIds.slice(0, shownChildren), textOnly)}
            
            {(expanded || textOnly) && shownChildren < childIds.length &&
            <button onClick={onShowMoreChildren}>...{childIds.length - shownChildren} more</button>}

        </div>
    );
}

Node = connect(mapStateToProps, mapDispatchToProps)(Node);

export default Node;