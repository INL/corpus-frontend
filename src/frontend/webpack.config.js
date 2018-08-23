const path = require('path');
const webpack = require('webpack');

module.exports = {
    entry: {
        article: './src/article.js',
        corpora: './src/corpora.js',
        search: './src/search.js',
    },
    output: {
        filename: '[name].js',
        // Path on disk for output file
        path: path.resolve(__dirname, 'dist'),
        // Path in webpack-dev-server for compiled files (has priority over disk files in case both exist)
        publicPath: '/dist/'
    },
    plugins: [
        // ProvidePlugin makes modules globally available under certain symbols, for both our own files as well as our imported dependencies.
        // This is unfortunately required to allow dependencies to augment other dependencies (such as jquery-ui augmenting jquery)
        // which requires the same instance of jquery to be visible to both the jquery-ui module as our own files
        // See vendor/index.js
        new webpack.ProvidePlugin({
            'window.jQuery':    'jquery',
            'jQuery':           'jquery',
            '$':                'jquery',
            'CodeMirror':       'codemirror',
        }),
    ],
};