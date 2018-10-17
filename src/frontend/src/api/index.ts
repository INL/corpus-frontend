import axios, {Canceler} from 'axios';
import * as qs from 'qs';

import {createEndpoint} from '@/utils/apiutils';
import {normalizeFormat, normalizeIndex} from '@/utils/blacklabutils';

import * as BLTypes from '@/types/blacklabtypes';
import { ApiError } from '@/types/apptypes';

declare const BLS_URL: string;

const blacklabEndpoint = createEndpoint({
	baseURL: BLS_URL.substring(0, BLS_URL.lastIndexOf('/', BLS_URL.length-2)+1),
	params: {
		outputformat: 'json',
	},
	paramsSerializer: params => qs.stringify(params)
});

// Some blacklab-server request creators
const paths = {
	/*
		Stupid issue, sending a request to /blacklab-server redirects to /blacklab-server/
		Problem is, the redirect response is missing the CORS header
		so the browser doesn't allow the redirect.
		There doesn't seem to be a way to fix this in the server as the redirect
		is performed by the servlet container and runs before any application code.
		So ensure our requests end with a trailing slash to prevent the server from redirecting
	*/
	root: () =>                             './',
	index: (indexId: string) =>             `${indexId}/`,
	indexStatus: (indexId: string) =>       `${indexId}/status/`,
	documentUpload: (indexId: string) =>    `${indexId}/docs/`,
	shares: (indexId: string) =>            `${indexId}/sharing/`,
	formats: () =>                          `input-formats/`,
	formatContent: (id: string) =>          `input-formats/${id}/`,
	formatXslt: (id: string) =>             `input-formats/${id}/xslt`,

	hits: (indexId: string) =>              `${indexId}/hits/`,
	docs: (indexId: string) =>              `${indexId}/docs`,
};

/**
 * Blacklab api
 */
export const blacklab = {
	getServerInfo: () => blacklabEndpoint
		.get<BLTypes.BLServer>(paths.root()),

	getUser: () => blacklabEndpoint
		.get<BLTypes.BLServer>(paths.root())
		.then(r => r.user),

	getCorpora: () => blacklabEndpoint
		.get<BLTypes.BLServer>(paths.root())
		.then(r => Object.entries(r.indices))
		.then(r => r.map(([id, index]: [string, BLTypes.BLIndex]) => normalizeIndex(id, index))),

	getCorpus: (id: string) => blacklabEndpoint
		.get<BLTypes.BLIndex>(paths.indexStatus(id))
		.then(r => normalizeIndex(id, r)),

	getShares: (id: string) => blacklabEndpoint
		.get<{'users[]': BLTypes.BLShareInfo}>(paths.shares(id))
		.then(r => r['users[]']),

	getFormats: () => blacklabEndpoint
		.get<BLTypes.BLFormats>(paths.formats())
		.then(r => Object.entries(r.supportedInputFormats))
		.then(r => r.map(([id, format]: [string, BLTypes.BLFormat]) => normalizeFormat(id, format))),

	getFormatContent: (id: string) => blacklabEndpoint
		.get<BLTypes.BLFormatContent>(paths.formatContent(id)),

	getFormatXslt: (id: string) => blacklabEndpoint
		.get<string>(paths.formatXslt(id)),

	postShares: (id: string, users: BLTypes.BLShareInfo) => blacklabEndpoint
		.post<BLTypes.BLResponse>(paths.shares(id),
			// Need to manually set content-type due to long-standing axios bug
			// https://github.com/axios/axios/issues/362
			qs.stringify({users: users.map(u => u.trim()).filter(u => u.length)}, {arrayFormat: 'brackets'}),
			{headers: {'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'}}
		),

	postFormat: (name: string, contents: string) => {
		const data = new FormData();
		data.append('data', new File([contents], name, {type: 'text/plain'}), name);
		return blacklabEndpoint.post<BLTypes.BLResponse>(paths.formats(), data);
	},

	postCorpus: (id: string, displayName: string, format: string) => blacklabEndpoint
		.post(paths.root(),
			qs.stringify({name: id, display: displayName, format}),
			{headers: {'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'}}
		),

	postDocuments: (
		indexId: string,
		docs: FileList,
		meta?: FileList|null,
		onProgress?: (percentage: number) => void
	) => {
		const formData = new FormData();
		for (let i = 0; i < (docs ? docs.length : 0); ++i) {
			formData.append('data', docs.item(i)!, docs.item(i)!.name);
		}
		for (let i = 0; i < (meta ? meta.length : 0); ++i) {
			formData.append('linkeddata', meta!.item(i)!, meta!.item(i)!.name);
		}

		const cancelToken = axios.CancelToken.source();
		return {
			request: blacklabEndpoint.post<BLTypes.BLResponse>(paths.documentUpload(indexId), formData, {
				headers: {
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

	getHits: (indexId: string, params: BLTypes.BlacklabParameters) => {
		const {token: cancelToken, cancel} = axios.CancelToken.source();

		let request: Promise<BLTypes.BlHitResults|BLTypes.BLHitGroupResults>;
		if (!indexId) {
			request = Promise.reject(new ApiError('Error', 'No index specified.', 'Internal error'));
		} else if (!params.patt) {
			request = Promise.reject(new ApiError('Info', 'Cannot get hits without pattern.', 'No results'));
		} else {
			request = blacklabEndpoint.get<BLTypes.BlHitResults|BLTypes.BLHitGroupResults>(paths.hits(indexId), {
				params,
				cancelToken
			});
		}

		return {
			request,
			cancel
		};
	},

	getDocs: (indexId: string, params: BLTypes.BlacklabParameters) => {
		const {token: cancelToken, cancel} = axios.CancelToken.source();

		let request: Promise<BLTypes.BLDocResults|BLTypes.BLDocGroupResults>;
		if (!indexId) {
			request = Promise.reject(new ApiError('Error', 'No index specified', 'Internal error'));
		} else {
			request = blacklabEndpoint.get<BLTypes.BLDocResults|BLTypes.BLDocGroupResults>(paths.docs(indexId), {
				params,
				cancelToken
			});
		}

		return {
			request,
			cancel
		};
	}
};

export {Canceler, ApiError};
