import axios, {AxiosResponse, AxiosRequestConfig, AxiosError} from 'axios';

import {ApiError} from '@/types/apptypes';
import {BLError} from '@/types/blacklabtypes';
import {isBLError} from '@/utils/blacklabutils';

const settings = {
	delay: 0,
};

export function delayResponse<T>(r: AxiosResponse<T>): Promise<AxiosResponse<T>> {
	return new Promise((resolve, reject) => {
		setTimeout(() => resolve(r), settings.delay);
	});
}

export function delayError<T>(e: AxiosError): Promise<AxiosResponse<never>> {
	return new Promise((resolve, reject) => {
		setTimeout(() => reject(e), settings.delay);
	});
}

export function swallowError(p: any) {/**/}

/**
 * Maps network error and blacklab error to ApiError.
 * For use with axios. Always returns a rejected promise containing the error.
 */
export async function handleError<T>(error: AxiosError): Promise<never> {
	if (!error.config) { // is a cancelled request, message containing details
		return Promise.reject(new ApiError('Request cancelled', `Request was cancelled: ${error}`, '')); // TODO some logic depends on the exact title to filter out cancelled requests
	}

	const response = error.response;
	if (!response) {
		throw new ApiError(
			error.message,
			'Could not connect to server at ' + error.config.url,
			'Server Offline'
		);
	}

	// Something else is going on, assume it's a blacklab-server error
	const contentType = (response.headers['content-type'] || '');
	if (isBLError(response.data)) {
		const blErr: BLError = response.data;
		return Promise.reject(new ApiError(
			response.data.error.code,
			response.data.error.message,
			response.statusText
		));
	} else if (contentType.indexOf('xml') >= 0 && typeof response.data === 'string') { // todo check content-type
		try {
			const text = response.data;
			const xml = new DOMParser().parseFromString(text, 'application/xml');

			const code = xml.querySelector('error code');
			const message = xml.querySelector('error message');

			if (code && message) {
				return Promise.reject(new ApiError(
					code.textContent!,
					message.textContent!,
					response.statusText
				));
			} else {
				return Promise.reject(new ApiError(
					response.statusText,
					`Server returned ${response.statusText} at: ${response.config.url}`,
					response.statusText
				));
			}
		} catch (e) {
			return Promise.reject(new ApiError(
				response.statusText,
				`Server returned ${response.statusText} at: ${response.config.url}`,
				response.statusText
			));
		}
	} else {
		return Promise.reject(new ApiError(
			response.statusText,
			`Server returned ${response.statusText} at: ${response.config.url}`,
			response.statusText
		));
	}
}

export function createEndpoint(options: AxiosRequestConfig) {
	const endpoint = axios.create(options);

	return {
		...endpoint,
		get<T>(url: string, config?: AxiosRequestConfig) {
			return endpoint.get<T>(url, config)
			.then(delayResponse, delayError)
			.then(r => r.data, handleError);
		},
		post<T>(url: string, data?: any, config?: AxiosRequestConfig) {
			return endpoint.post<T>(url, data, config)
			.then(delayResponse, delayError)
			.then(r => r.data, handleError);
		},
		delete<T>(url: string, data?: any, config?: AxiosRequestConfig) {
			// Need to use the generic .request function because .delete
			// returns a void promise by design, yet blacklab sends response bodies
			return endpoint.request<T>({
				...config,
				method: 'DELETE',
				url,
			})
			.then(delayResponse, delayError)
			.then(r => r.data, handleError);
		}
	};
}