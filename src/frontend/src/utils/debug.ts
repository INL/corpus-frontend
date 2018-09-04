import * as _$ from 'jquery';

let debug = false;

let queued: IArguments[] = [];

// If you wish to see the original logging location, blackbox this script in the chrome devtools
// For now, seeing the original location is not supported in firefox and edge/ie (and probably safari)
export function debugLog(...args: any[]) {
	if (debug) {
		console.log.apply(console, arguments); // tslint:disable-line
	} else {
		queued.push(arguments);
	}
}

export function enable() {
	debug = true;
	for (const argArray of queued) {
		debugLog.apply(undefined, argArray);
	}
	queued = [];
}

export function disable() {
	debug = false;
}

export default function() {
	return debug;
}

// DEBUGGING ONLY, this should probably use node.env
window.jquery = window.$ = _$;
