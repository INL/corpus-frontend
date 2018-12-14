// This import is processed by @babel/preset-env preset (see .babelrc file) and expanded into all polyfills required by/detected inside this bundle
// ('this bundle' referring to the entire output .js bundle where all modules are concatenated etc by webpack, not just this .ts file)
// NOTE: this only supports those polyfills contained within core-js (the polyfill lib used by @babel/polyfill internally), most notably window.fetch is NOT polyfilled by this import
import '@babel/polyfill';

// And fetch, for some reason...
import 'whatwg-fetch';

// Except these polyfills, as they are still stage-3 as of writing, and preset-env doesn't support them
// It also doesn't expand into polyfills for features that haven't been accepted into the ecma standard yet
import 'core-js/fn/array';

// DEBUGGING ONLY, this should probably use node.env
import _$ from 'jquery';
(window as any).jquery = (window as any).$ = _$;
