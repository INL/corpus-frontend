import React from 'react';
import {connect} from 'react-redux';

import ConfigForm, {FieldTypes} from './Form';
import {XpathTypes} from '../reducers/xpath';
import XpathModal from './XpathModal';
import {openModal} from '../reducers/ui/xpathModal';

const fieldDescriptors = [{
    id: ".name",
    name: 'Name',
    description: "The internal name for your format",
    
    fieldType: FieldTypes.TEXT
}, {
    id: ".displayName",
    name: 'Display Name',
    description: "A recognisable name for the format you're going to be importing." ,
    
    fieldType: FieldTypes.TEXT,
}, {
    id: ".description",
    name: 'Description',
    description: "A short description for the format you're going to be importing.",
    
    fieldType: FieldTypes.TEXT,
}, {
    id: ".docPath",
    name: "Document Path",
    description: "The xml element that starts a new document within your file. For example <document>.",

    fieldType: FieldTypes.XPATH,
    xpathType: XpathTypes.NODES
}, {
    id: ".wordPath",
    name: "Word Path",
    description: "The xml element that starts a new word within a document",

    fieldType: FieldTypes.XPATH,
    xpathType: XpathTypes.NODES
}, {
    id: ".annotations",
    name: "Annotations (word properties)",
    description: "The properties of each word that should be indexed, and their location in the file. (for example word, lemma, part of speech)",

    fieldType: FieldTypes.ARRAY,
    fields: [{
        id: ".name",
        name: "Property name",
        description: "The name for this property in the index (and the name it can be searched by).",

        fieldType: FieldTypes.TEXT,
    }, {
        id: ".path",
        name: "Value path",
        description: "The xml element that contains the value for this property.",

        fieldType: FieldTypes.XPATH,
        xpathType: XpathTypes.VALUES
    }]
}, {
    id: ".inlineTags",
    name: "Inline tags",
    description: "Tags other than words that should also be indexed. This can be things like paragraph and sentence start and ending tags. \n" +
    "Their positions will be preserved relative to the word tags within the documents. \n",

    fieldType: FieldTypes.ARRAY,
    fields: [{
        id: ".path",
        name: "Path",
        description: "The xml element that should be indexed.",

        fieldType: FieldTypes.XPATH,
        xpathType: XpathTypes.NODES
    }, {
        id: ".description",
        name: "Description",
        description: "A short description for the meaning of this tag.",

        fieldType: FieldTypes.TEXT,
    }]
}, {
    id: ".metadata",
    name: "Metadata",
    description: "Configuration for the metadata that should be indexed for each document.",

    fieldType: FieldTypes.SET,
    fields: [{
        id: ".path",
        name: "Container",
        description: "The top level xml element(s) that contains all the metadata for a document.",

        fieldType: FieldTypes.XPATH,
        xpathType: XpathTypes.NODES
    }, {
        id: ".singlePaths",
        name: "Single tag",
        description: "Paths to specific pieces of metadata you want to store under a name you provide.",
        
        fieldType: FieldTypes.ARRAY,
        fields: [{
            id: ".name",
            name: "Name",
            description: "The name under which this metadata will be indexed.",

            fieldType: FieldTypes.TEXT,
        }, {
            id: ".path",
            name: "Path",
            description: "The xml element containing this piece of metadata.",

            fieldType: FieldTypes.XPATH,
            xpathType: XpathTypes.VALUES
        }]
    }, {
        id: ".forEachPaths",
        name: "Variable metadata",
        description: "Bits of metadata which have the names and values embedded in the document itself.",

        fieldType: FieldTypes.ARRAY,
        fields: [{
            id: ".path",
            name: "Metadata path",
            description: "Path to the element for a single metadata value.",

            fieldType: FieldTypes.XPATH,
            xpathType: XpathTypes.NODES
        }, {
            id: ".namePath",
            name: "Name path",
            description: "Within the metadata element, what contains the name for the metadata.",

            fieldType: FieldTypes.XPATH,
            xpathType: XpathTypes.VALUES
        }, {
            id: ".valuePath",
            name: "Value path",
            description: "Within the metadata element, what contains the value for the metadata.",

            fieldType: FieldTypes.XPATH,
            xpathType: XpathTypes.VALUES
        }]
    }]
}]

const mapStateToProps = null;
const mapDispatchToProps = ({
    handleOpenEditor: openModal
})


class App extends React.Component {
    render = () => {
        const {handleOpenEditor} = this.props;

        return (
            <div className="modal-container">
                <ConfigForm model="forms.configForm" fieldDescriptors={fieldDescriptors} onEditorOpen={handleOpenEditor} container={this}/>
                <XpathModal container={this}/>
            </div>
        )
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(App);