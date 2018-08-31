import * as BLTypes from '../../types/blacklabtypes';

export type UrlParameters = {
	// page: number,
	// pageSize: number,
	// sampleMode: null,
	// sampleSize: null,
	// sampleSeed: null,
	// wordsAroundHit: null,
	// pattern: null,
	// within: null,
	// filters: null,
	// sort: null,
	// groupBy: null,
	// viewGroup: null,
	// caseSensitive: null,
	// operation?: 'docs'|'hits',
};

/* Values are string on purpose, the decoded values in urijs are always string or arrays of strings, so preserve this for our defaults */
const defaults: {[key: string]: string|string[]} = {
	pageSize: '20',
};

class UrlPageState {
	private url: string;
	private params: {[key: string]: string|string[]|null};


	numberOrDefault(p: string|string[]|undefined, default: number) {
		if (typeof p === Array) {

		}
	}

	get page(): number {
		let {
			start = '0',
			number: count = defaults.pageSize
		} = this.params;
		start = Number.parseInt(start) || 0;
		count = Number.parseInt(count) || 20;
	}

}


export type PageState = {};

export const fromUrl = (): PageState => {
	/*
		A lot of work will need to happen here, because urls can contain arbitrary data
		So the internal state will need to be decoded and made consistent
		This becomes harder because pagestate and url state are not neat 1:1 mappings
		For instance, the case-sensitive grouping has only a single page element, but
		controls multiple parts of the url (all the group names)
		When we enter the page, the url is not guaranteed to be consistent with what we'd generate ourselves (user may edit it)

		This means we will need to sanitize the pagestate object before returning it
		then probably overwriting the url with the corrected version before we actually do anything

		if we want to allow some extra properties without setters on the page (i.e. a checkbox or something)
		then we can just add and deserialize the properties here
	*/

	return {};
};

export const toUrl = () => {
	//
};
