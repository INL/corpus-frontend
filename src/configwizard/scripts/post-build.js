/* 
    Copies files in the build directory to another configurable directory and removes the hash from the file names.
    The files are named and moved based on the asset-manifest.json file in the build folder.
    The target output directory needs to be supplied as argument to this script.
    
    This script should be run using nodejs and takes one argument: the target directory to place the copied files into.
    Running it is simply "node post-build.js ./path/to/target/directory".
    This is done automatically when performing "npm run build" as defined in the package.json "scripts.build" property. 
    
    
    We do this so it is easier to integrate the generated files into an existing web project as they now have a static name.
   
    Note that any dependencies for this script need to specified in the master package.json for this project.
 */

const fs = require('fs-extra'); 
const path = require('path');

console.log("running post-build step");

// We should be running in the root js project directory (the dir containing package.json);
let targetDirectory = process.argv[2]; // when running in nodejs, arguments 0 and 1 are "node" and the path/filename for this script respectively
if (!targetDirectory) {
    console.log("Please provide a target directory for the files");
    console.log("Invoke this script using 'node path/to/post-build.js ../your/target/directory'");
    process.exit(1);
}

targetDirectory = path.resolve(targetDirectory);

fs.pathExists(targetDirectory)
.then(exists => { 
	if (exists) 
		return fs.remove(targetDirectory);
	else 
		return Promise.resolve();
})
.then(() => fs.readFile('build/asset-manifest.json'))
.then(data => JSON.parse(data+''))
.then(json => Promise.all(Object.getOwnPropertyNames(json).map(key => {
    const sourceLocation = path.join('build', json[key]);
    const targetLocation = path.join(targetDirectory, key);
    
    console.log(`Copying file ${sourceLocation} to ${targetLocation}`);
    return fs.copy(sourceLocation, targetLocation);
})))
.then(() => {
    console.log("Finished copying files!");
    process.exit(0);
})
.catch(error =>  {
    console.log(`An error occured while moving compiled files to static location. Message: ${error.message}`);
    process.exit(1);
})