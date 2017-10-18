import '../../css/FileButton.css';

import React from 'react';

let FileButton = ({onChange, children}) => (
    <div className="btn btn-primary button-file">
        Select File
        <input type="file" 
            onChange={(e) => {e.preventDefault(); onChange(e.target.files[0])}}
        />
    </div>
);


export default FileButton;