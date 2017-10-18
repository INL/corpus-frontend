import React from 'react';
import {connect} from 'react-redux';

import {Modal, Button} from 'react-bootstrap';

import XmlTree from './XmlTree';
import FileButton from './FileButton';

import {selectors} from '../reducers';
import {setConfigFormFieldAndCloseModal, changeAndParseFile} from '../logic';
import {closeModal} from '../reducers/ui/xpathModal';

const mapStateToProps = (state) => ({
    open: selectors.isXpathModalShown(state)
})
const mapDispatchToProps = ({
    handleConfirm: setConfigFormFieldAndCloseModal,
    handleCancel: closeModal,
    handleFileChange: changeAndParseFile
})

let XpathModal = ({open, handleConfirm, handleCancel, handleFileChange}) => (
    <Modal show={open} onHide={handleCancel}>
        <Modal.Header closeButton>
            <Modal.Title>Modal heading edited</Modal.Title>
        </Modal.Header>
        <Modal.Body>
            <div style={ { minHeight: "500px", maxHeight: "500px", height: "500px", overflow: "auto" } }>
                <XmlTree/>  
            </div>
            <div className="text-center">
                <FileButton onChange={handleFileChange}/>
            </div>

        </Modal.Body>
        <Modal.Footer>
            <Button onClick={handleCancel}>Close</Button>
            <Button onClick={handleConfirm}>Save</Button>
        </Modal.Footer>
    </Modal>
)


export default connect(mapStateToProps, mapDispatchToProps)(XpathModal);