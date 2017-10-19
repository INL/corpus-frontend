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

let XpathModal = ({open, handleConfirm, handleCancel, handleFileChange, container}) => (
    <Modal show={open} onHide={handleCancel} container={container}>
        <Modal.Header closeButton>
            <Modal.Title>Modal heading edited</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{
            maxHeight: "500px",
            overflowY: "auto"
        }}>
            <XmlTree/>  
        </Modal.Body>
        <Modal.Footer>
            
            <div className="text-center" style={{position: "relative"}}>
                <FileButton onChange={handleFileChange}/>

                <div style={{position:"absolute", right:0, top:0}}>
                    <Button onClick={handleCancel}>Close</Button>
                    <Button onClick={handleConfirm}>Save</Button>
                </div>
            </div>
        </Modal.Footer>
    </Modal>
)

export default connect(mapStateToProps, mapDispatchToProps)(XpathModal);