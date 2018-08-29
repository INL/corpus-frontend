const path = require('path');
const webpack = require('webpack');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');

module.exports = {
	entry: {
		article: ['@babel/polyfill', './src/article.js'],
		corpora: ['@babel/polyfill', './src/corpora.js'],
		search: ['@babel/polyfill', './src/search.js'],
	},
	output: {
		filename: '[name].js',
		// Path on disk for output file
		path: path.resolve(__dirname, 'dist'),
		// Path in webpack-dev-server for compiled files (has priority over disk files in case both exist)
		publicPath: '/dist/'
	},
	resolve: {
		extensions: ['.js', '.ts'] // enable autocompleting .ts and .js extensions when using import '...'
	},
	module: {
		// Make several modules available globally (i.e. the browser console) under "cf.*"
		// Helps with development and debugging and allows user scripts to hook in to some of the functionality
		// NOTE: This is only to help debugging and development, all inter-module communication should go through the normal
		// import/exports
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
			test: /\.tsx?$/,
			use: [{
				loader: 'ts-loader',
				options: {
					// disables type checking (typescript compiler now just removes type annotations basically)
					// required for webpack-dev-server hot module replacement to work
					// see https://github.com/TypeStrong/ts-loader/tree/d8096aac0061cdd0ef9228fee5a0c2d137eca34f/examples/hot-module-replacement
					// We get back type checking through fork-ts-checker-webpack-plugin (https://github.com/Realytics/fork-ts-checker-webpack-plugin)
					// This runs type checks outside the main webpack thread, also speeds up compilation significantly (though with this size project it's a non-issue)
					transpileOnly: true,
				}
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
		// NOTE: the exports of these modules are not made available through the window object in the browser!
		// To do that, we need to use the expose-loader.
		new webpack.ProvidePlugin({
			'window.jQuery':    'jquery',
			'jQuery':           'jquery',
			'$':                'jquery',
			'CodeMirror':       'codemirror',
		}),

		new ForkTsCheckerWebpackPlugin(),
	],
	stats: {
		// Some extraneous warnings from using ts-loader with transpileOnly true
		warningsFilter: /export .* was not found in/,
	},
	devtool: 'eval-souce-map'
};