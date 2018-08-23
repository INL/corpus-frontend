const path = require('path');

module.exports = {
    entry: {
        article: './src/article.js',
        corpora: './src/corpora.js',
        search: './src/search.js',
    },
    output: {
        filename: '[name].js',
        path: path.resolve(__dirname, 'dist'),
    },
};