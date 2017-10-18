process.env.BABEL_ENV = 'production';
process.env.NODE_ENV = 'production';

require('../config/env');

const util = require('util'); // for object logging
const webpack = require('webpack');
const config = require('../config/webpack.config.prod');

config.watch = true;

const watcher = webpack(config).watch({
    ignored: /node_modules/
}, (err, stats) => {
    if (err) {
        console.error(err.stack || err);
        if (err.details) {
            console.error(err.details);
        }
        return;
    }

    const info = stats.toJson();

    if (stats.hasErrors()) {
        console.error(info.errors);
    }

    if (stats.hasWarnings()) {
        console.warn(info.warnings)
    }

    console.log("Finished compiling.");
});

console.log("File watcher has been started.");

const exitHandler = () => {
    new Promise((resolve, reject) => {
        console.log("Stopping file watcher...");
        watcher.close(resolve)
    })
    .then(() => {
        console.log("File watcher stopped.")
    })
    .catch(error => {
        console.warn("Could not stop file watcher!");
    })
    .then(() => process.exit());
}

process.on('SIGINT', exitHandler);
process.on('SIGTERM', exitHandler);
