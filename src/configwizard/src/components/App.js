import React from 'react';
import {connect} from 'react-redux';

import ConfigForm, {FieldTypes} from './Form';
import {XpathTypes} from '../reducers/ui/xpathContext';
import XpathModal from './XpathModal';
import {openModalAndRefreshXpath} from '../logic/';

const fieldDescriptors = [{
    model: ".name",
    name: 'Name',
    description: "The internal name for your format",
    
    fieldType: FieldTypes.TEXT
}, {
    model: ".displayName",
    name: 'Display Name',
    description: "A recognisable name for the format you're going to be importing." ,
    
    fieldType: FieldTypes.TEXT,
}, {
    model: ".description",
    name: 'Description',
    description: "A short description for the format you're going to be importing.",
    
    fieldType: FieldTypes.TEXT,
}, {
    model: ".docPath",
    name: "Document Path",
    description: "The xml element that starts a new document within your file. For example <document>.",

    fieldType: FieldTypes.XPATH,
    xpathType: XpathTypes.NODES,

    parent: null,
}, {
    model: ".wordPath",
    name: "Word Path",
    description: "The xml element that starts a new word within a document",

    fieldType: FieldTypes.XPATH,
    xpathType: XpathTypes.NODES,
    parent: ["docPath"]
}, {
    model: ".annotations",
    name: "Annotations (word properties)",
    description: "The properties of each word that should be indexed, and their location in the file. (for example word, lemma, part of speech)",

    fieldType: FieldTypes.ARRAY,
    fields: [{
        model: ".name",
        name: "Property name",
        description: "The name for this property in the index (and the name it can be searched by).",

        fieldType: FieldTypes.TEXT,
    }, {
        model: ".path",
        name: "Value path",
        description: "The xml element that contains the value for this property.",

        fieldType: FieldTypes.XPATH,
        xpathType: XpathTypes.VALUES,
        parent: ["..", "wordPath"]
    }]
}, {
    model: ".inlineTags",
    name: "Inline tags",
    description: "Tags other than words that should also be indexed. This can be things like paragraph and sentence start and ending tags. \n" +
    "Their positions will be preserved relative to the word tags within the documents. \n",

    fieldType: FieldTypes.ARRAY,
    fields: [{
        model: ".path",
        name: "Path",
        description: "The xml element that should be indexed.",

        fieldType: FieldTypes.XPATH,
        xpathType: XpathTypes.NODES,
        parent: ["..", "docPath"]        
    }, {
        model: ".description",
        name: "Description",
        description: "A short description for the meaning of this tag.",

        fieldType: FieldTypes.TEXT,
    }]
}, {
    model: ".metadata",
    name: "Metadata",
    description: "Configuration for the metadata that should be indexed for each document.",

    fieldType: FieldTypes.SET,
    fields: [{
        model: ".path",
        name: "Container",
        description: "The top level xml element(s) that contains all the metadata for a document.",

        fieldType: FieldTypes.XPATH,
        xpathType: XpathTypes.NODES,
        parent: ["..", "docPath"]
    }, {
        model: ".singlePaths",
        name: "Single tag",
        description: "Paths to specific pieces of metadata you want to store under a name you provide.",
        
        fieldType: FieldTypes.ARRAY,
        fields: [{
            model: ".name",
            name: "Name",
            description: "The name under which this metadata will be indexed.",

            fieldType: FieldTypes.TEXT,
        }, {
            model: ".path",
            name: "Path",
            description: "The xml element containing this piece of metadata.",

            fieldType: FieldTypes.XPATH,
            xpathType: XpathTypes.VALUES,
            parent: ["..", "path"]
        }]
    }, {
        model: ".forEachPaths",
        name: "Variable metadata",
        description: "Bits of metadata which have the names and values embedded in the document itself.",

        fieldType: FieldTypes.ARRAY,
        fields: [{
            model: ".path",
            name: "Metadata path",
            description: "Path to the element for a single metadata value.",

            fieldType: FieldTypes.XPATH,
            xpathType: XpathTypes.NODES,
            parent: ["..", "path"]
        }, {
            model: ".namePath",
            name: "Name path",
            description: "Within the metadata element, what contains the name for the metadata.",

            fieldType: FieldTypes.XPATH,
            xpathType: XpathTypes.VALUES,
            parent: ["path"]
        }, {
            model: ".valuePath",
            name: "Value path",
            description: "Within the metadata element, what contains the value for the metadata.",

            fieldType: FieldTypes.XPATH,
            xpathType: XpathTypes.VALUES,
            parent: ["path"]
        }]
    }]
}]

const mapStateToProps = null;
const mapDispatchToProps = ({
    handleOpenEditor: openModalAndRefreshXpath
})

/**
 * The current problem we're having is that the xpaths are relative to each other
 * when opening the modal, we need to evaluate the xpath state of all parent form fields 
 * however to do that we need the names of those fields (because we need SOME way to store their state)
 * and we don't have that, since those names are dynamic (some of them might be in arrays, etc)
 * then on top of that, we need that same compounded state when evaluating new xpath and offering up options about the new xpath.
 * (when the parent has attributes selected, the children should only ever be able to select options pertaining to attributes)
 * 
 * there is some logic in logic.js that contains the basic path resolving required to get the parent
 * this would not be required if we can set the parent statically, WE MIGHT BE ABLE TO DO THIS when first rendering the field, as the name is resolved there
 * then we can resolve the parent name by traversing up and down
 * we'd still need to attach the extra data to the form field's value, which might be possible using the getValue prop, which is a dom even callback?
 * 
 * 
 */
class App extends React.Component {
    render = () => {
        const {handleOpenEditor} = this.props;

        return (
            <div className="modal-container">
                <ConfigForm model="configForm" fieldDescriptors={fieldDescriptors} onEditorOpen={handleOpenEditor} container={this}/>
                <XpathModal container={this}/>
            </div>
        )
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(App);