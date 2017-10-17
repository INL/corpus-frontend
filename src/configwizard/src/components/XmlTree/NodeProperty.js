import React, {Component} from 'react';
import {connect} from 'react-redux';

import {selectors} from '../../reducers';

// import {selectXpathTarget} from '../../reducers/xpath';
import {openDropdown} from '../../reducers/ui/xpathDropdown';

// TODO memoize so no rerender every state change
const mapStateToProps = (state, ownProps) => ({
    ...selectors.getNode(state, ownProps.nodeId),
    isHighlighted: selectors.isNodeHighlighted(state, ownProps.nodeId)
})

const mapDispatchToProps = (dispatch, ownProps) => ({
    handleClick: (coordinates) => dispatch(openDropdown(coordinates, ownProps.nodeId))
})

class NodeProperty extends Component {
    saveRef = (el) => this.setState({el})
    
    // This could be handled in a higher-order component if we wanted, but since this is a one-off component anyway it doesn't matter.
    handleClick = () => {
        const el = this.state.el;

        this.props.handleClick ({
            left: el.offsetLeft,
            top: el.offsetTop + el.offsetHeight
        })
    }

    render() {
        const {isHighlighted, type, name, data} = this.props;
        
        return (
            <span key={name} className={`node-property ${type}`} ref={this.saveRef}>
                {name && <span className={`name material-1 material-hover-2  ${isHighlighted ? "highlight" : ""}`} onClick={this.handleClick }>{name}</span>}
                {data && <span className={`value material-1 material-hover-2  ${isHighlighted ? "highlight" : ""}`} onClick={this.handleClick }>{data}</span>}
            </span>
        )
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(NodeProperty);