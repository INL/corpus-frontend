import axios, {Canceler, AxiosRequestConfig} from 'axios';
import * as qs from 'qs';

import {createEndpoint} from '@/api/apiutils';
import {normalizeIndexOld, normalizeFormatOld, normalizeIndex, fixDocInfo} from '@/utils/blacklabutils';

import * as BLTypes from '@/types/blacklabtypes';
import { ApiError } from '@/types/apptypes';
import { Glossing } from '@/store/search/form/glossStore';
import { AtomicQuery, LexiconEntry } from '@/store/search/form/conceptStore';

declare const BLS_URL: string;

type API = ReturnType<typeof createEndpoint>;

const endpoints = {
	blacklab: null as any as API,
	gloss: null as any as API,
	concept: null as any as API,
};

/** Initialize an endpoint. In a function because urls might be set asynchronously (such as from customjs). */
export function init(which: keyof typeof endpoints, url: string, settings: Partial<AxiosRequestConfig> = {}) {
	if (!(which in endpoints)) throw new Error(`Unknown endpoint ${which}`);
	endpoints[which] = createEndpoint({
		baseURL: url.replace(/\/*$/, '/'),
		paramsSerializer: params => qs.stringify(params),
		...settings,
	});
}

init('blacklab', BLS_URL, {params: {outputFormat: 'json'}});

// We need this for transforming metadata fields in reponses from (optional) strings to (required) arrays
// i.e. polyfilling missing document info fields in responses.
// const allMetadataFields = CorpusStore.get.allMetadataFields().map(f => f.id);

/** Contains url mappings for different requests to blacklab-server */
export const blacklabPaths = {
	/*
		Stupid issue, sending a request to /blacklab-server redirects to /blacklab-server/
		Problem is, the redirect response is missing the CORS header
		so the browser doesn't allow the redirect.
		There doesn't seem to be a way to fix this in the server as the redirect
		is performed by the servlet container and runs before any application code.
		So ensure our requests end with a trailing slash to prevent the server from redirecting
	*/
	root: () =>                                     './',
	index: (indexId: string) =>                     `${indexId}/`,
	indexStatus: (indexId: string) =>               `${indexId}/status/`,
	documentUpload: (indexId: string) =>            `${indexId}/docs/`,
	shares: (indexId: string) =>                    `${indexId}/sharing/`,
	formats: () =>                                  `input-formats/`,
	formatContent: (id: string) =>                  `input-formats/${id}/`,
	formatXslt: (id: string) =>                     `input-formats/${id}/xslt`,

	docInfo: (indexId: string, docId: string) =>    `${indexId}/docs/${docId}`,
	hits: (indexId: string) =>                      `${indexId}/hits/`,
	hitsCsv: (indexId: string) =>                   `${indexId}/hits-csv/`,
	docs: (indexId: string) =>                      `${indexId}/docs/`,
	docsCsv: (indexId: string) =>                   `${indexId}/docs-csv/`,
	snippet: (indexId: string, docId: string) =>    `${indexId}/docs/${docId}/snippet/`,

	// Is used outside the axios endpoint we created above, so prefix with the correct location
	autocompleteAnnotation: (
		indexId: string,
		annotatedFieldId: string,
		annotationId: string) =>                    `${endpoints.blacklab.defaults.baseURL}${indexId}/autocomplete/${annotatedFieldId}/${annotationId}/`,
	// Is used outside the axios endpoint we created above, so prefix with the correct location
	autocompleteMetadata: (
		indexId: string,
		metadataFieldId: string) =>                 `${endpoints.blacklab.defaults.baseURL}${indexId}/autocomplete/${metadataFieldId}/`,
	termFrequencies: (indexId: string) =>           `${indexId}/termfreq/`,
};

/**
 * Blacklab api
 */
export const blacklab = {
	getServerInfo: (requestParameters?: AxiosRequestConfig) => endpoints.blacklab
		.get<BLTypes.BLServer>(blacklabPaths.root(), requestParameters),

	getUser: (requestParameters?: AxiosRequestConfig) => endpoints.blacklab
		.get<BLTypes.BLServer>(blacklabPaths.root(), requestParameters)
		.then(r => r.user),

	getCorpora: (requestParameters?: AxiosRequestConfig) => endpoints.blacklab
		.get<BLTypes.BLServer>(blacklabPaths.root(), requestParameters)
		.then(r => Object.entries(r.indices))
		.then(r => r.map(([id, index]: [string, BLTypes.BLIndex]) => normalizeIndexOld(id, index))),

	getCorpusStatus: (id: string, requestParamers?: AxiosRequestConfig) => endpoints.blacklab
		.get<BLTypes.BLIndex>(blacklabPaths.indexStatus(id), requestParamers)
		.then(r => normalizeIndexOld(id, r)),

	getCorpus: (id: string, requestParameters?: AxiosRequestConfig) => endpoints.blacklab
		.get<BLTypes.BLIndexMetadata>(blacklabPaths.index(id), requestParameters)
		.then(normalizeIndex),

	getShares: (id: string, requestParameters?: AxiosRequestConfig) => endpoints.blacklab
		.get<{'users[]': BLTypes.BLShareInfo}>(blacklabPaths.shares(id), requestParameters)
		.then(r => r['users[]']),

	getFormats: (requestParameters?: AxiosRequestConfig) => endpoints.blacklab
		.get<BLTypes.BLFormats>(blacklabPaths.formats(), requestParameters)
		.then(r => Object.entries(r.supportedInputFormats))
		.then(r => r.map(([id, format]: [string, BLTypes.BLFormat]) => normalizeFormatOld(id, format))),

	getFormatContent: (id: string, requestParameters?: AxiosRequestConfig) => endpoints.blacklab
		.get<BLTypes.BLFormatContent>(blacklabPaths.formatContent(id), requestParameters),

	getFormatXslt: (id: string, requestParameters?: AxiosRequestConfig) => endpoints.blacklab
		.get<string>(blacklabPaths.formatXslt(id), requestParameters),

	postShares: (id: string, users: BLTypes.BLShareInfo, requestParameters?: AxiosRequestConfig) => endpoints.blacklab
		.post<BLTypes.BLResponse>(blacklabPaths.shares(id),
			// Need to manually set content-type due to long-standing axios bug
			// https://github.com/axios/axios/issues/362
			qs.stringify({users: users.map(u => u.trim()).filter(u => u.length)}, {arrayFormat: 'brackets'}),
			{
				...requestParameters,
				headers: {
					...(requestParameters || {}).headers,
					'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
				}
			}
		),

	postFormat: (name: string, contents: string, requestParameters?: AxiosRequestConfig) => {
		const data = new FormData();
		data.append('data', new File([contents], name, {type: 'text/plain'}), name);
		return endpoints.blacklab.post<BLTypes.BLResponse>(blacklabPaths.formats(), data, requestParameters);
	},

	postCorpus: (id: string, displayName: string, format: string, requestParameters?: AxiosRequestConfig) => endpoints.blacklab
		.post(blacklabPaths.root(),
			qs.stringify({name: id, display: displayName, format}),
			{
				...requestParameters,
				headers: {
					...(requestParameters || {}).headers,
					'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
				}
			}
		),

	postDocuments: (
		indexId: string,
		docs: File[],
		meta?: File[]|null,
		onProgress?: (percentage: number) => any,
		requestParameters?: AxiosRequestConfig
	) => {
		const formData = new FormData();
		for (let i = 0; i < (docs ? docs.length : 0); ++i) {
			formData.append('data', docs[i], docs[i].name);
		}
		for (let i = 0; i < (meta ? meta.length : 0); ++i) {
			formData.append('linkeddata', meta![i], meta![i].name);
		}

		const cancelToken = axios.CancelToken.source();
		return {
			request: endpoints.blacklab.post<BLTypes.BLResponse>(blacklabPaths.documentUpload(indexId), formData, {
				...requestParameters,
				headers: {
					...(requestParameters || {}).headers,
					'Content-Type': 'multipart/form-data',
				},
				onUploadProgress: (event: ProgressEvent) => {
					if (onProgress) {
						onProgress(event.loaded / event.total * 100);
					}
				},
				cancelToken: cancelToken.token
			}),
			cancel: cancelToken.cancel
		};
	},

	deleteFormat: (id: string) => endpoints.blacklab
		.delete<BLTypes.BLResponse>(blacklabPaths.formatContent(id)),

	deleteCorpus: (id: string) => endpoints.blacklab
		.delete<BLTypes.BLResponse>(blacklabPaths.index(id)),

	getDocumentInfo: (indexId: string, documentId: string, params: { query?: string; } = {}, requestParameters?: AxiosRequestConfig) =>
		getOrPost<BLTypes.BLDocument>(blacklabPaths.docInfo(indexId, documentId), params, requestParameters),

	getHits: (indexId: string, params: BLTypes.BLSearchParameters, requestParameters?: AxiosRequestConfig) => {
		const {token: cancelToken, cancel} = axios.CancelToken.source();

		let request: Promise<BLTypes.BLHitResults|BLTypes.BLHitGroupResults>;
		if (!indexId) {
			request = Promise.reject(new ApiError('Error', 'No index specified.', 'Internal error'));
		} else if (!params.patt) {
			request = Promise.reject(new ApiError('Info', 'Cannot get hits without pattern.', 'No results'));
		} else {
			request = getOrPost(blacklabPaths.hits(indexId), params, { ...requestParameters, cancelToken });
		}

		return {
			request,
			cancel
		};
	},

	getHitsCsv: (indexId: string, params: BLTypes.BLSearchParameters, requestParameters?: AxiosRequestConfig) => {
		const {token: cancelToken, cancel} = axios.CancelToken.source();
		const csvParams = Object.assign({}, params, {
			number: undefined,
			first: undefined,
			outputformat: 'csv'
		});

		let request: Promise<Blob>;
		if (!indexId) {
			request = Promise.reject(new ApiError('Error', 'No index specified.', 'Internal error'));
		} else if (!params.patt) {
			request = Promise.reject(new ApiError('Info', 'Cannot get hits without pattern.', 'No results'));
		} else {
			request = getOrPost(blacklabPaths.hitsCsv(indexId), csvParams, {
				...requestParameters,
				headers: {
					...(requestParameters || {}).headers,
					Accept: 'text/csv'
				},
				responseType: 'blob',
				transformResponse: (data: any) => new Blob([data], {type: 'text/plain;charset=utf-8' }),
				cancelToken,
			});
		}

		return {
			request,
			cancel
		};
	},

	getDocsCsv(indexId: string, params: BLTypes.BLSearchParameters, requestParameters?: AxiosRequestConfig) {
		const {token: cancelToken, cancel} = axios.CancelToken.source();
		const csvParams = Object.assign({}, params, {
			number: undefined,
			first: undefined,
			outputformat: 'csv'
		});

		let request: Promise<Blob>;
		if (!indexId) {
			request = Promise.reject(new ApiError('Error', 'No index specified', 'Internal error'));
		} else {
			request = getOrPost<Blob>(blacklabPaths.docsCsv(indexId), csvParams, {
				...requestParameters,
				headers: {
					...(requestParameters || {}).headers,
					Accept: 'text/csv'
				},
				responseType: 'blob',
				transformResponse: (data: any) => new Blob([data], {type: 'text/plain;charset=utf-8' }),
				cancelToken,
			});
		}

		return {
			request,
			cancel
		};
	},

	getDocs: (indexId: string, params: BLTypes.BLSearchParameters, requestParameters?: AxiosRequestConfig) => {
		const {token: cancelToken, cancel} = axios.CancelToken.source();

		let request: Promise<BLTypes.BLDocResults|BLTypes.BLDocGroupResults>;
		if (!indexId) {
			request = Promise.reject(new ApiError('Error', 'No index specified', 'Internal error'));
		} else {
			request = getOrPost<BLTypes.BLDocResults|BLTypes.BLDocGroupResults>(blacklabPaths.docs(indexId), params, { ...requestParameters, cancelToken })
			.then(res => {
				if (!BLTypes.isDocGroups(res)) {
					res.docs.forEach(d => fixDocInfo(d.docInfo));
				}
				return res;
			});
		}

		return {
			request,
			cancel
		};
	},

	getSnippet: (indexId: string, docId: string, hitstart: number, hitend: number, wordsaroundhit: number = 50, requestParameters?: AxiosRequestConfig) => {
		return getOrPost<BLTypes.BLHitSnippet>(blacklabPaths.snippet(indexId, docId), {
			hitstart,
			hitend,
			wordsaroundhit
		}, requestParameters);
	},

	getTermFrequencies: (indexId: string, annotationId: string, values?: string[], filter?: string, requestParameters?: AxiosRequestConfig) => {
		return getOrPost<BLTypes.BLTermOccurances>(blacklabPaths.termFrequencies(indexId), {
			annotation: annotationId,
			filter,
			terms: values && values.length ? values.join(',') : undefined,
		}, requestParameters);
	}
};

export const glossPaths = {
	/*
		Stupid issue, sending a request to /blacklab-server redirects to /blacklab-server/
		Problem is, the redirect response is missing the CORS header
		so the browser doesn't allow the redirect.
		There doesn't seem to be a way to fix this in the server as the redirect
		is performed by the servlet container and runs before any application code.
		So ensure our requests end with a trailing slash to prevent the server from redirecting
	*/
	root: () => './',
	glosses: () => `GlossStore` // NOTE: no trailing slash!
}

export const glossApi = {
	getCql: (instance: string, author: string, corpus: string, query: string) => endpoints.gloss
		.get<''|Glossing[]>(glossPaths.glosses(), { params: {
			instance,
			author,
			corpus,
			query
		}})
		.then(glossings => !glossings ? '' : glossings
			.filter(g => g.hit_first_word_id?.length > 3)
			.map(g => {
				if (g.hit_first_word_id !== g.hit_last_word_id)
					return `([_xmlid='${g.hit_first_word_id}'][]*[_xmlid='${g.hit_last_word_id}'])`;
				else
					return `([_xmlid='${g.hit_first_word_id}'])`
			})
			.join("| ")
		),
	storeGlosses: (instance: string, glossings: Glossing[]) => endpoints.gloss
		.post(glossPaths.glosses(), qs.stringify({
			instance,
			glossings: JSON.stringify(glossings)
		})),
	getGlosses: (instance: string, corpus: string, author: string, hitIds: string[]) => endpoints.gloss
		.get<Glossing[]>(glossPaths.glosses(), {
			params: {
				instance,
				corpus,
				author,
				hitIds: JSON.stringify(hitIds)
			}
		}),

}

export const conceptPaths = {
	mainFields: () => `api`,
	query_to_cql: () => `BlackPaRank`
}

export const conceptApi = {
	/** Data contains duplicates currently. */
	getMainFields: (instance: string, corpus: string) => endpoints.concept
		.get<{data: LexiconEntry[]}>(conceptPaths.mainFields(), {
			params: {
				instance,
				query: `query Quine { lexicon(corpus : "${corpus}") { field } }`
			}
		}),
	translate_query_to_cql: (
		blacklabBackendEndpoint: string,
		corpus: string,
		element: string,
		queries: Record<string, AtomicQuery[]>,
	): Promise<{pattern: string}> => endpoints.concept
		.get<{pattern: string}>(conceptPaths.query_to_cql(), {
			headers: {
				Accept: 'application/json'
			},
			params: {
				server: blacklabBackendEndpoint,
				corpus,
				action: 'info',
				query: JSON.stringify({
					element,
					strict: true,
					filter: '',
					queries
				})
			}
		}),
		// TODO move queries in ConceptSearchBox.vue here.
}

// Server has issues with long urls.
function getOrPost<R>(path: string, params: any, settings?: AxiosRequestConfig): Promise<R> {
	const queryString = params ? qs.stringify(params) : '';
	const usePost = queryString.length > 1000;
	// const usePost = params && (params.patt ? params.patt.length : 0)+(params.filter ? params.filter.length : 0)+(params.pattgapdata ? params.pattgapdata.length : 0) > 1000;
	if (usePost) {
		settings = settings || {};
		settings.headers = settings.headers || {};
		settings.headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8';

		// override the default-set outputformat if another is provided.
		// Or it will be sent in both the request body and the query string causing unpredictable behavior in what is actually returned.
		if (params.outputformat) {
			settings.params = settings.params || {};
			settings.params.outputformat = params.outputformat;
		}

		return endpoints.blacklab.post<R>(path, queryString, settings);
	} else {
		return endpoints.blacklab.get<R>(path, { ...settings, params});
	}
}

export {Canceler, ApiError};
