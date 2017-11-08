import "../../css/TestForm.css";

import React from 'react';
import {connect} from 'react-redux';
// import {Form, Control, Fieldset, actions} from 'react-redux-form';
// import getValue from 'react-redux-form/lib/utils/get-value';

// TODO fix model string concatenating

import {initializeField, setValue, createField, removeField} from '../../reducers/ui/simpleForm';

import {selectors} from '../../reducers';

export const FieldTypes = {
    ARRAY: 'ARRAY',
    SET: 'SET',

    TEXT: 'TEXT',
    XPATH: 'XPATH'
}

// props contains descriptor + react-redux-form injected properties 
class RenderField extends React.Component {

    constructor(props) {
        super(props)
        this.props.onConstruction();
    }

    storeInput = element => this.input = element;

    shouldComponentUpdate = (newProps, newState) => {
        const curProps = this.props;
        const self = this;
        
        // const equal = Object.entries(newProps).every(([key, value]) => {
        //     // First check if it's the same in curprops and newprops, then check if it's the "value" property, and if so, check if it's the same as our <input>'s "value" property
        //     // We do this to avoid a rerender when our value changes -> it goes into the store, then comes back to us as a prop change.
        //     // In this case, since we caused the prop change ourselves, there's no need to rerender.
        //     // return curProps[key] === value || (key === "value" && self.input.value === value);
        //     return 
        // })
        
        // return !equal;
        return true;
    }

    render = () => {
        const {descriptor, onValueChange, onEditorOpen, parentModel, value} = this.props;
        const {name, description, model, fieldType} = descriptor;
        
        // console.log(`rendering input field ${parentModel + model}, value: ${value}`);

        let inputElement = <input 
            type="text" 
            className="form-control"
            name={parentModel + model} 
            value={value} 
            onChange={event => {
                if (event && event.target && event.target.value) 
                    onValueChange(event.target.value)
            }} 
            ref={this.storeInput} // keep a reference for future use.
            />
        
        if (fieldType === FieldTypes.XPATH) {
            inputElement = (
                <div className="input-group">
                    {inputElement}
                    <span className="input-group-btn">
                        <button className="btn btn-default" type="button" onClick={ (event) => onEditorOpen(parentModel + model)}>Pick a node</button>
                    </span>
                </div>
            )
        }

        return (
            <div className="form-group">
                {name && <label>{name}</label>}
                {inputElement}
                {description && <p className="help-block">{description}</p>}
            </div>
        )
    }
}

const mapStateToPropsRenderField = (state, ownProps) => {
    const model = ownProps.parentModel + ownProps.descriptor.model;
    
    const value = {
        value: selectors.getFormValue(state, model) || ""
    }

    // console.log(`value for model ${model} = ${value.value}`);
    return value;
}
// NOTE: all functions here should be memoized, or the comparison in shouldComponentUpdate will return false 
// (as the actual function will be a new instance) and cause components to always rerender.
const mapDispatchToPropsRenderField = (dispatch, ownProps) => {
    const model = ownProps.parentModel + ownProps.descriptor.model;
    
    return {
        onValueChange: (value) => dispatch(setValue(model, value)),
        onConstruction: () => dispatch(initializeField(model, ownProps.descriptor))
    }
}

RenderField = connect(mapStateToPropsRenderField, mapDispatchToPropsRenderField)(RenderField);

//------------------
//  RenderFieldArray
//------------------

let RenderFieldArray = (props) => {
    const {descriptor, parentModel, onAddField, onRemoveField, value} = props;
    
    const {name, description, fields, model} = descriptor;

    return (
    <div className="form-field-array">
        {name && <label>{name}</label>}
        {description && <p className="help-block">{description}</p>}
        <button type="button" onClick={onAddField} className="btn btn-default add-field-button">+</button>
        { 
            value && value.map((element, valueIndex) => {
                const removeButton = <button type="button" onClick={() => onRemoveField(valueIndex)}>Remove</button>;
                const renderedFields = fields.map(subfieldDescriptor => renderFieldDescriptor({
                    ...props,
                    descriptor: subfieldDescriptor,
                    parentModel: `${parentModel}${model}[${valueIndex}]`
                }));

                return [renderedFields, removeButton];
            })
        }
    </div>
    )
}

const mapStateToPropsRenderFieldArray = (state, ownProps) => {
    // console.log("mapstatetoprops for array");
    return {
        value: selectors.getFormValue(state, ownProps.parentModel + ownProps.descriptor.model)
    }
}

const mapDispatchToPropsRenderFieldArray = (dispatch, ownProps) => ({
    onAddField: () => dispatch(createField(ownProps.parentModel + ownProps.descriptor.model)),
    onRemoveField: (index) => dispatch(removeField(ownProps.parentModel + ownProps.descriptor.model, index)),
})

RenderFieldArray = connect(mapStateToPropsRenderFieldArray, mapDispatchToPropsRenderFieldArray)(RenderFieldArray);


const RenderFieldSet = (props) => {
    const {descriptor, parentModel} = props;
    const {name, description, fields, model} = descriptor;
    
    return (
        <div className="form-field-set">
            <label>{name}</label>
            <p className="help-block">{description}</p>
            {fields.map(field => renderFieldDescriptor( {
                ...props, 
                descriptor: field,
                parentModel: parentModel + model
            }))
            } 
        </div>
    )
}

//props is stateprops and dispatchprops (the same for every field atm) + the descriptor values such as name etc.
// does not contain any information from redux-form.
const renderFieldDescriptor = (props) => {
    switch (props.descriptor.fieldType) {
        case undefined: throw new Error("No field type defined!");
        case FieldTypes.ARRAY: return <RenderFieldArray {...props}/>;
            // return <Control.custom 
            //     model={descriptor.id} 
            //     component={renderFieldArray} 
            //     controlProps={props} 
            //     mapProps={{
            //         model: props => props.model, 
            //         value: props => props.viewValue
            //     }}
            // />
        case FieldTypes.SET: return <RenderFieldSet {...props}/>;
            // return <Fieldset 
            //     model={descriptor.id} 
            //     component={renderFieldSet} 
            //     {...props} //props are passed as-is for fieldset
            // /> 
        default: return <RenderField {...props}/>;
            // return <Control.text
            //     model={descriptor.id}
            //     component={renderField}
            //     controlProps={props}
            // /> 
    }
}

export default ({model, fieldDescriptors, onEditorOpen}) => {
    
    return (
        <form>
        {fieldDescriptors.map(descriptor => renderFieldDescriptor({descriptor, parentModel: model, onEditorOpen}) )}
        </form>
    )
}