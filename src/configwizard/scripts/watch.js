process.env.BABEL_ENV = 'production';
process.env.NODE_ENV = 'production';

require('react-scripts/config/env');

const util = require('util'); // for object logging
const webpack = require('webpack');
const config = require('react-scripts/config/webpack.config.prod');

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

    console.log("Did a recompile!");
});

console.log("compiler should be watching now?");

const exitHandler = () => {
    console.log("exithandler running");

    watcher.close(() => console.log("closed watcher"));
    process.exit();
}

process.on('SIGINT', exitHandler);
process.on('SIGTERM', exitHandler);
