let debug = false;

let queued = [];

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
	for (let i = 0; i < queued.length; ++i) {
		debugLog.apply(undefined, queued[i]);
	}
	queued = [];
}

export function disable() {
	debug = false;
}

export default function() {
	return debug;
}
