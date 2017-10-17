import '../../css/XmlTree.css';
import '../../css/Material.css';

import React from 'react';
import {connect} from 'react-redux';

import {selectors} from '../../reducers/';
import {changeAndParseFile} from '../../logic/';

import Node from './Node';
import Dropdown from './Dropdown';

const mapStateToProps = (state) => ({
    rootNodeId: selectors.getRootNodeId(state)
})

const mapDispatchToProps = ({
    handleFileChange: changeAndParseFile
})

let XmlTree = ({rootNodeId, handleFileChange}) => (
    <div className="xml-tree">
        <Dropdown/>
        {rootNodeId != null && <Node nodeId={rootNodeId}/>}
    </div>
)

export default connect(mapStateToProps, mapDispatchToProps)(XmlTree);