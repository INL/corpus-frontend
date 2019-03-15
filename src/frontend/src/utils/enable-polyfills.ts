// This import is processed by @babel/preset-env preset (see .babelrc file) and expanded into all polyfills required by/detected inside this bundle
// ('this bundle' referring to the entire output .js bundle where all modules are concatenated etc by webpack, not just this .ts file)
// NOTE: this only supports those polyfills contained within core-js (the polyfill lib used by @babel/polyfill internally), most notably window.fetch is NOT polyfilled by this import
import '@babel/polyfill';

// And fetch, for some reason...
import 'whatwg-fetch';

// Except these polyfills, as they are still stage-3 as of writing, and preset-env doesn't support them
// It also doesn't expand into polyfills for features that haven't been accepted into the ecma standard yet
import 'core-js/fn/array';
import 'core-js/web';

// Ironic, our core-js polyfills are behind the ecma standard
if (typeof Array.prototype.flat !== 'function') {
	Array.prototype.flat = (Array.prototype as any).flatten;
}

// from:https://github.com/jserz/js_piece/blob/master/DOM/ChildNode/remove()/remove().md
([Element.prototype, CharacterData.prototype, DocumentType.prototype])
.filter(e => !e.hasOwnProperty('remove'))
.forEach(item => Object.defineProperty(item, 'remove', {
	configurable: true,
	enumerable: true,
	writable: true,
	value: function remove() {
		if (this.parentNode !== null) {
			this.parentNode.removeChild(this);
		}
	}
}));

if (!Element.prototype.matches) {
	// @ts-ignore
	Element.prototype.matches = Element.prototype.msMatchesSelector || Element.prototype.webkitMatchesSelector;
}

if (!Element.prototype.closest) {
	Element.prototype.closest = function(s: string) {
		let el: any = this;
		do {
			if (el.matches(s)) {
				return el;
			}
			el = el.parentElement || el.parentNode;
		} while (el !== null && el.nodeType === 1);
		return null;
	};
}

// DEBUGGING ONLY, this should probably use node.env and be exposed through expose-loader
import _$ from 'jquery';
(window as any).jquery = (window as any).$ = _$;
