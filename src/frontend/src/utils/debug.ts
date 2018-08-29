var debug = false;

var queued = [];

// If you wish to see the original logging location, blackbox this script in the chrome devtools
// For now, seeing the original location is not supported in firefox and edge/ie (and probably safari)
export function debugLog() {
	if (debug) {
		console.log.apply(console, arguments); // eslint-disable-line
	} else {
		queued.push(arguments);
	}
}

export function enable() {
	debug = true;
	for (var i = 0; i < queued.length; ++i) {
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