This is a javascript project created with create-react-app (a project generator for reactjs applications).
To build it you will need to install nodejs & npm (node package manager, comes with node) (https://nodejs.org/en/).
Run "npm install" in this directory to install dependencies. Then run "npm run build" to create compiled files in the "build" directory.

The compiled file are copied into the parent corpus-frontend project by the post-build.js script in the scripts folder.
This script takes a directory as argument, the directory is specified in the package.json scripts.build property.

As long as the index.html file in the public directory remains in place, it's possible to run this project standalone by running "npm start" in this directory.
This will spin up a local server that serves index.html and the compiled files and supports hot-reloading and better debugging.