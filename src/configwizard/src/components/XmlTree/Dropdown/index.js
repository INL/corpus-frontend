import React from 'react';
import {connect} from 'react-redux';

import {Dropdown, MenuItem} from 'react-bootstrap';

import {selectors} from '../../../reducers';
import {changeXpathConfigAndRecalculateXpath} from '../../../logic';
import {closeDropdown} from '../../../reducers/ui/xpathDropdown';

const mapStateToProps = (state) => ({
    position: selectors.getXpathDropdownPosition(state),
    shown: selectors.isXpathDropdownShown(state),
    options: selectors.getXpathDropdownOptions(state),
    nodeId: selectors.getXpathDropdownTargetNodeId(state)
})
const mapDispatchToProps = (dispatch) => ({
    handleOptionClicked: (option, nodeId) => dispatch(changeXpathConfigAndRecalculateXpath(option, nodeId)),
    handleToggleOpen: (requestedOpenState, event, source) => {
        if (requestedOpenState === true)
            return; //only ever open from outside influences
        else 
            dispatch(closeDropdown());
    }
});

const myDropdown = (props) => {
    const {position, shown, nodeId, options, handleOptionClicked, handleToggleOpen} = props;
    console.log("dropdown props: ", props);

    const innerStyle = {     
        top: position.top,
        left: position.left,
        display: "block" // required to counteract display: inline-block for react-bootstrap Dropdown, which aligns wrong due to baseline
    }

    return (
        <div className="xml-tree-dropdown-wrapper"> 
            <Dropdown open={shown} style={innerStyle} onToggle={handleToggleOpen}>
            <Dropdown.Menu>
                <MenuItem header>Test header</MenuItem>
                {/* TODO don't confound nodeId and documentNode */}
                {options.map(opt => <MenuItem onClick={() => handleOptionClicked(opt, nodeId)}>{opt.displayName}</MenuItem>)}
            </Dropdown.Menu>
            </Dropdown>
        </div>
    )
}

export default connect(mapStateToProps, mapDispatchToProps)(myDropdown);
