import axios, {AxiosResponse, AxiosRequestConfig, AxiosError} from 'axios';

import {ApiError} from '@/types/apptypes';
import {isBLError} from '@/types/blacklabtypes';

// See header.vm
declare const WITH_CREDENTIALS: boolean;

const settings = {
	// use a builtin delay to simulate network latency (in ms)
	delay: 0,
	// whether to set withCredentials in axios settings
	// This will send cookies with requests, which is required for authentication
	// HOWEVER, it requires a very specific setup to work, either of the following must be true:
	// a) the server must not set the Access-Control-Allow-Origin header to '*'
	// b) the client and the server must use the same protocol + domain + port
	// Any other case will result in a CORS error, even when there are no cookies.
	// so it's best to turn this off during development.

	withCredentials: WITH_CREDENTIALS,
};

export function delayResponse<T>(r: AxiosResponse<T>): Promise<AxiosResponse<T>> {
	return new Promise((resolve, reject) => {
		setTimeout(() => resolve(r), settings.delay);
	});
}

export function delayError(e: AxiosError): Promise<AxiosResponse<never>> {
	return new Promise((resolve, reject) => {
		setTimeout(() => reject(e), settings.delay);
	});
}

/**
 * Maps network error and blacklab error to ApiError.
 * For use with axios. Always returns a rejected promise containing the error.
 */
export async function handleError(error: AxiosError): Promise<never> {
	if (!error.config) { // is a cancelled request, message containing details
		return Promise.reject(new ApiError('Request cancelled', `Request was cancelled: ${error}`, '')); // TODO some logic depends on the exact title to filter out cancelled requests
	}

	const response = error.response;
	if (!response) {
		return Promise.reject(new ApiError(
			error.message,
			'Could not connect to server at ' + error.config.url,
			'Server Offline'
		));
	}

	// Something else is going on, assume it's a blacklab-server error
	const contentType: string = (response.headers['content-type'] || '');
	if (isBLError(response.data)) {
		return Promise.reject(new ApiError(
			response.data.error.code,
			response.data.error.message,
			response.statusText
		));
	} else if (contentType.toLowerCase().indexOf('xml') >= 0 && typeof response.data === 'string') {
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
	const endpoint = axios.create({
		withCredentials: settings.withCredentials,
		...options
	});

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