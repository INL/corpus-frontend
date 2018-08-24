const path = require('path');
const webpack = require('webpack');

module.exports = {
	entry: {
		article: ['babel-polyfill', './src/article.js'],
		corpora: ['babel-polyfill', './src/corpora.js'],
		search: ['babel-polyfill', './src/search.js'],
	},
	output: {
		filename: '[name].js',
		// Path on disk for output file
		path: path.resolve(__dirname, 'dist'),
		// Path in webpack-dev-server for compiled files (has priority over disk files in case both exist)
		publicPath: '/dist/'
	},
	module: {
		// Make several modules available globally (i.e. the browser console) under "cf.*"
		// Helps with development and debugging and allows user scripts to hook in to some of the functionality
		rules: [{
			test: require.resolve('./src/utils/debug.js'),
			use: [{
				loader: 'expose-loader',
				options: 'cf.debug'
			}]
		}, {
			test: require.resolve('./src/corpora.js'),
			use: [{
				loader: 'expose-loader',
				options: 'cf.core'
			}]
		}, {
			test: require.resolve('./src/modules/singlepage-form.js'),
			use: [{
				loader: 'expose-loader',
				options: 'cf.mainform'
			}]
		}, {
			test: require.resolve('./src/modules/singlepage-interface.js'),
			use: [{
				loader: 'expose-loader',
				options: 'cf.search'
			}]
		}, {
			test: /\.js$/,
			exclude: [/node_modules/, './src/vendor'],
			loader: 'babel-loader',
		},]
	},
	plugins: [
		// ProvidePlugin makes modules globally available under certain symbols, for both our own files as well as our imported dependencies.
		// This is unfortunately required to allow dependencies to augment other dependencies (such as jquery-ui and bootstrap augmenting jquery)
		// which requires the same instance of jquery to be visible to both the jquery-ui module as our own files
		// See vendor/index.js
		new webpack.ProvidePlugin({
			'window.jQuery':    'jquery',
			'jQuery':           'jquery',
			'$':                'jquery',
			'CodeMirror':       'codemirror',
		}),
	],
	devtool: 'eval-souce-map'
};