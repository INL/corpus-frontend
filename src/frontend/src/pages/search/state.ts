import Rx from 'rxjs';

export type UrlParameters = {
	page: number,
	pageSize: number,
	sampleMode: null,
	sampleSize: null,
	sampleSeed: null,
	wordsAroundHit: null,
	pattern: null,
	within: null,
	filters: null,
	sort: null,
	groupBy: null,
	viewGroup: null,
	caseSensitive: null,
	operation?: 'docs'|'hits',
};

export const fromUrl = () => {
	//
};
