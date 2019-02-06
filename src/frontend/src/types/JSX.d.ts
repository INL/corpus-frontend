/**
 * IntrinsicElements is basically a whitelist of tags typescript supports within jsx.
 * We can do things like specify all valid attributes and listeners on a per-tag basis.
 * But that's a lot of work and error-prone, so instead whitelist everything...
 */

import {VNodeData} from 'vue';

declare global {
	namespace JSX {
		interface IntrinsicElements {
			[key: string]: VNodeData;
		}
	}
}