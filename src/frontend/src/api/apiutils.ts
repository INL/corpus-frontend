import axios, {AxiosResponse, AxiosRequestConfig, AxiosError} from 'axios';

import {ApiError} from '@/types/apptypes';
import {isBLError} from '@/types/blacklabtypes';

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
		return Promise.reject(new ApiError('Request cancelled', `Request was cancelled: ${error}`, '', undefined)); // TODO some logic depends on the exact title to filter out cancelled requests
	}

	const response = error.response;
	if (!response) {
		return Promise.reject(new ApiError(
			error.message,
			'Could not connect to server at ' + error.config.url,
			'Server Offline',
			undefined
		));
	}

	// Something else is going on, assume it's a blacklab-server error
	const contentType: string = (response.headers['content-type'] || '');
	if (isBLError(response.data)) {
		return Promise.reject(new ApiError(
			response.data.error.code,
			response.data.error.message,
			response.statusText,
			response.status
		));
	} else if (contentType.toLowerCase().includes('xml') && typeof response.data === 'string' && response.data.length) {
		try {
			const text = response.data;
			const xml = new DOMParser().parseFromString(text, 'application/xml');

			/* blacklab errors in xml format look like this:
			<error>
				<code>PATT_SYNTAX_ERROR</code>
				<message>Syntax error in CorpusQL pattern (JSON parse failed as well): Error parsing query: Encountered "<EOF>" at line 1, column 9. Was expecting one of: ":" ... ":" ... </message>
			</error>
			*/
			const code = xml.querySelector('code');
			const message = xml.querySelector('message');

			if (code && message) {
				return Promise.reject(new ApiError(
					code.textContent!,
					message.textContent!,
					response.statusText,
					response.status
				));
			} else {
				return Promise.reject(new ApiError(
					`Server returned an error (${response.statusText}) at: ${response.config.url}`,
					xml.textContent || response.data, // return just the text of the xml document.
					response.statusText,
					response.status
				));
			}
		} catch (e) {
			return Promise.reject(new ApiError(
				`Server returned an error (${response.statusText}) at: ${response.config.url}`,
				response.data, // just print the raw text we received
				response.statusText,
				response.status
			));
		}
	} else {
		return Promise.reject(new ApiError(
			`Server returned an unexpected error at: ${response.config.url}`,
			response.data,
			response.statusText,
			response.status
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