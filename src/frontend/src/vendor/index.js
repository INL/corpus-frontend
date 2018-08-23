/** 
 * Import all dependencies that augment other dependencies.
 * The to-be-augmented dependencies need to be made globally available
 * so that when these modules run they augment the right instance of the global module
 * This is done by adding them to the webpack provide plugin in webpack.config.js
 */

// Bootstrap and bootstrap-select augment jquery
import 'bootstrap';
import 'bootstrap-select';

// Same for jqueryui
import 'jquery-ui';

// Whereas these augment codemirror
import 'codemirror/mode/javascript/javascript.js';
import 'codemirror/mode/yaml/yaml.js';