export function makeWildcardRegex(original: string) {
	return original
		.replace(/([\^$\-\\.(){}[\]+])/g, '\\$1') // add slashes for regex characters
		.replace(/\*/g, '.*') // * -> .*
		.replace(/\?/g, '.'); // ? -> .
}

export function makeRegexWildcard(original: string) {
	return original
	.replace(/\\([\^$\-\\(){}[\]+])/g, '$1') // remove most slashes
	.replace(/\\\./g, '_ESC_PERIOD_') // escape \.
	.replace(/\.\*/g, '*') // restore *
	.replace(/\./g, '?') // restore ?
	.replace(/_ESC_PERIOD_/g, '.') // unescape \. to .
}

export const NaNToNull = (n: number) => isNaN(n) ? null : n;
