import "../../css/bootstrap.css";
import "../../css/TestForm.css";

import React from 'react';
import {connect} from 'react-redux';
import {Form, Control, Fieldset, actions} from 'react-redux-form';

export const FieldTypes = {
    ARRAY: 'ARRAY',
    SET: 'SET',

    TEXT: 'TEXT',
    XPATH: 'XPATH'
}

const renderInput = ({descriptor, onEditorOpen, ...inputProps}) => {
    inputProps.value = inputProps.value || "";
    let inputElement = <input type="text" {...inputProps} className="form-control"/>

    console.log("injected props", inputProps);

    if (descriptor.fieldType === FieldTypes.XPATH) {
        inputElement = (
            <div className="input-group">
                {inputElement}
                <span className="input-group-btn">
                    <button className="btn btn-default" type="button" onClick={event => onEditorOpen(inputProps.name)}>Pick a node</button>
                </span>
            </div>
        )
    }

    return inputElement;
}

// props contains descriptor + react-redux-form injected properties 
const renderField = (props) => {
    console.log("renderfield props", props);
    
    const {descriptor} = props;

    return (
        <div className="form-group">
            {descriptor.name && <label>{descriptor.name}</label>}
            {renderInput(props)}
            {descriptor.description && <p className="help-block">{descriptor.description}</p>}
        </div>
    )
}

let renderFieldArray = (props) => {
    console.log("fieldarray props", props);
    
    const {descriptor, value = [], onAddField, onRemoveField, model, ...restProps} = props;
    const {id: parentId} = descriptor;

    return <div className="form-field-array">
        {descriptor.name && <label>{descriptor.name}</label>}
        {descriptor.description && <p className="help-block">{descriptor.description}</p>}
        <button type="button" onClick={onAddField} className="btn btn-default add-field-button">+</button>
        {
            value.map((element, valueIndex) => {
                const removeButton = <button type="button" onClick={() => onRemoveField(valueIndex)}>Remove</button>;
                const fields = descriptor.fields.map(subfieldDescriptor => {
                    const subfieldProps = {
                        descriptor: {
                            ...subfieldDescriptor,
                            id: `${parentId}[${valueIndex}]${subfieldDescriptor.id}` //.parent[index].child, required because we are an RRF-Control, and our children's paths are not made relative to ours automatically, in contrast to Fieldset and Form
                        },
                        ...restProps
                    }

                    return renderFieldDescriptor(subfieldProps);
                })

                return [fields, removeButton];
            })
        }
    </div>
}

renderFieldArray = connect(null, (dispatch, ownProps) => ({
    onAddField: () => dispatch(actions.push(ownProps.model, {})),
    onRemoveField: (index) => dispatch(actions.remove(ownProps.model), index)
}))(renderFieldArray)


const renderFieldSet = (props) => {
    
    console.log("fieldset props", props);
    
    const {descriptor: parentDescriptor} = props;
    return (
        <div className="form-field-set">
            <label>{parentDescriptor.name}</label>
            <p className="help-block">{parentDescriptor.description}</p>
            {parentDescriptor.fields.map(descriptor => renderFieldDescriptor({...props, descriptor}))} 
        </div>
    )
}

//props is stateprops and dispatchprops (the same for every field atm) + the descriptor values such as name etc.
// does not contain any information from redux-form.
const renderFieldDescriptor = (props) => {
    const {descriptor} = props;
    
    switch (descriptor.fieldType) {
        case undefined:         throw new Error("No field type defined!");
        case FieldTypes.ARRAY:  return <Control.custom model={descriptor.id} component={renderFieldArray} controlProps={props} mapProps={{model: props => props.model, value: props => props.viewValue}}/>
        case FieldTypes.SET:    return <Fieldset model={descriptor.id} component={renderFieldSet} {...props}/> //props are passed as-is for fieldset
        default:                return <Control.text model={descriptor.id} component={renderField} controlProps={props}/> 
    }
}

export default ({model, fieldDescriptors, onEditorOpen}) => {
    return (
        <Form model={model}>
        {fieldDescriptors.map(descriptor => renderFieldDescriptor({descriptor, onEditorOpen}) )}
        </Form>
    )
}