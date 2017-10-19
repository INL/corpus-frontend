process.env.BABEL_ENV = 'production';
process.env.NODE_ENV = 'production';

require('../config/env');

const chalk = require('chalk');
const util = require('util'); // for object logging
const webpack = require('webpack');
const config = require('../config/webpack.config.prod'); //dev version does not write out css files, needs more research.


config.watch = true;
config.plugins.push(new webpack.ProgressPlugin({ profile: false }));

console.log("\nStarting file watcher...");

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
        console.log(chalk.bgRed('Errors were found:'));
        info.errors.forEach(error => console.log(error));
    }

    if (stats.hasWarnings()) {
        console.log(chalk.yellow('Warnings were found:'));
        info.warnings.forEach(warning => console.log(warning));
    }

    console.log("Finished compiling.");
});

console.log("\nFile watcher has been started.");

const exitHandler = () => {
    new Promise((resolve, reject) => {
        console.log("\nStopping file watcher...");
        watcher.close(resolve)
    })
    .then(() => {
        console.log("\nFile watcher stopped.")
        return 0;
    })
    .catch(error => {
        console.warn("\nCould not stop file watcher!");
        return 1;
    })
    .then(code => process.exit(code));
}

process.on('SIGINT', exitHandler);
process.on('SIGTERM', exitHandler);
