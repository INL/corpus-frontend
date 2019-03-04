import axios, {Canceler, AxiosRequestConfig} from 'axios';
import * as qs from 'qs';

import {createEndpoint} from '@/api/apiutils';
import {normalizeIndexOld, normalizeFormatOld} from '@/utils/blacklabutils';

import * as BLTypes from '@/types/blacklabtypes';
import { ApiError } from '@/types/apptypes';

declare const BLS_URL: string;

const blacklabEndpoint = createEndpoint({
	baseURL: BLS_URL.replace(/\/*$/, '/'),
	params: {
		outputformat: 'json',
	},
	paramsSerializer: params => qs.stringify(params)
});

/** Contains url mappings for different requests to blacklab-server */
export const paths = {
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

	autocompleteAnnotation: (
		indexId: string,
		annotatedFieldId: string,
		annotationId: string) =>                    `${blacklabEndpoint.defaults.baseURL}${indexId}/autocomplete/${annotatedFieldId}/${annotationId}/`,
	autocompleteMetadata: (
		indexId: string,
		metadataFieldId: string) =>                 `${blacklabEndpoint.defaults.baseURL}${indexId}/autocomplete/${metadataFieldId}/`
};

/**
 * Blacklab api
 */
export const blacklab = {
	getServerInfo: (requestParameters?: AxiosRequestConfig) => blacklabEndpoint
		.get<BLTypes.BLServer>(paths.root(), requestParameters),

	getUser: (requestParameters?: AxiosRequestConfig) => blacklabEndpoint
		.get<BLTypes.BLServer>(paths.root(), requestParameters)
		.then(r => r.user),

	getCorpora: (requestParameters?: AxiosRequestConfig) => blacklabEndpoint
		.get<BLTypes.BLServer>(paths.root(), requestParameters)
		.then(r => Object.entries(r.indices))
		.then(r => r.map(([id, index]: [string, BLTypes.BLIndex]) => normalizeIndexOld(id, index))),

	getCorpus: (id: string, requestParameters?: AxiosRequestConfig) => blacklabEndpoint
		.get<BLTypes.BLIndex>(paths.indexStatus(id), requestParameters)
		.then(r => normalizeIndexOld(id, r)),

	getShares: (id: string, requestParameters?: AxiosRequestConfig) => blacklabEndpoint
		.get<{'users[]': BLTypes.BLShareInfo}>(paths.shares(id), requestParameters)
		.then(r => r['users[]']),

	getFormats: (requestParameters?: AxiosRequestConfig) => blacklabEndpoint
		.get<BLTypes.BLFormats>(paths.formats(), requestParameters)
		.then(r => Object.entries(r.supportedInputFormats))
		.then(r => r.map(([id, format]: [string, BLTypes.BLFormat]) => normalizeFormatOld(id, format))),

	getFormatContent: (id: string, requestParameters?: AxiosRequestConfig) => blacklabEndpoint
		.get<BLTypes.BLFormatContent>(paths.formatContent(id), requestParameters),

	getFormatXslt: (id: string, requestParameters?: AxiosRequestConfig) => blacklabEndpoint
		.get<string>(paths.formatXslt(id), requestParameters),

	postShares: (id: string, users: BLTypes.BLShareInfo, requestParameters?: AxiosRequestConfig) => blacklabEndpoint
		.post<BLTypes.BLResponse>(paths.shares(id),
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
		return blacklabEndpoint.post<BLTypes.BLResponse>(paths.formats(), data, requestParameters);
	},

	postCorpus: (id: string, displayName: string, format: string, requestParameters?: AxiosRequestConfig) => blacklabEndpoint
		.post(paths.root(),
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
			request: blacklabEndpoint.post<BLTypes.BLResponse>(paths.documentUpload(indexId), formData, {
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

	deleteFormat: (id: string) => blacklabEndpoint
		.delete<BLTypes.BLResponse>(paths.formatContent(id)),

	deleteCorpus: (id: string) => blacklabEndpoint
		.delete<BLTypes.BLResponse>(paths.index(id)),

	getDocumentInfo: (indexId: string, documentId: string, params: { query?: string; } = {}, requestParameters?: AxiosRequestConfig) =>
		getOrPost<BLTypes.BLDocument>(paths.docInfo(indexId, documentId), params, requestParameters),

	getHits: (indexId: string, params: BLTypes.BLSearchParameters, requestParameters?: AxiosRequestConfig) => {
		const {token: cancelToken, cancel} = axios.CancelToken.source();

		let request: Promise<BLTypes.BLHitResults|BLTypes.BLHitGroupResults>;
		if (!indexId) {
			request = Promise.reject(new ApiError('Error', 'No index specified.', 'Internal error'));
		} else if (!params.patt) {
			request = Promise.reject(new ApiError('Info', 'Cannot get hits without pattern.', 'No results'));
		} else {
			request = getOrPost(paths.hits(indexId), params, { ...requestParameters, cancelToken });
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
			request = getOrPost(paths.hitsCsv(indexId), csvParams, {
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
			request = getOrPost<Blob>(paths.docsCsv(indexId), csvParams, {
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
			request = getOrPost(paths.docs(indexId), params, { ...requestParameters, cancelToken });
		}

		return {
			request,
			cancel
		};
	},

	getSnippet: (indexId: string, docId: string, hitstart: number, hitend: number, wordsaroundhit: number = 50, requestParameters?: AxiosRequestConfig) => {
		return getOrPost<BLTypes.BLHitSnippet>(paths.snippet(indexId, docId), {
			hitstart,
			hitend,
			wordsaroundhit
		}, requestParameters);
	}
};

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

		return blacklabEndpoint.post<R>(path, queryString, settings);
	} else {
		return blacklabEndpoint.get<R>(path, { ...settings, params});
	}
}

export {Canceler, ApiError};
