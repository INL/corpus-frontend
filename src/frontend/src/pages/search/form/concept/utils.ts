import { BLError } from '@/types/blacklabtypes';
import { AxiosError, AxiosResponse } from 'axios';

export function shuffle_array(array0: any[]): any[] { // in utils zetten ofzo
	const array =  [...array0];
	let currentIndex = array.length,  randomIndex;

	// While there remain elements to shuffle...
	while (currentIndex != 0) {
		// Pick a remaining element...
		randomIndex = Math.floor(Math.random() * currentIndex);
		currentIndex--;

		// And swap it with the current element.
		[array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
	}
	return array;
}

export function log_error(error: AxiosError) {
	if (error.response) { // Request made and server responded
		console.log('error response received:')
		console.log(error.response.data)
		console.log(error.response.status)
		console.log(error.response.headers)
	} else if (error.request) { // The request was made but no response was received
		console.log('No response. Request:')
		console.log(error.request);
	} else { // Something happened in setting up the request that triggered an Error
		console.log('Request not set up,')
		console.log('Error::', error.message);
	}
}

/** Recursively map all functions to strings in the type T. IE any occurance of () => any inside typeof T is replaced with string. */
type FunctionToString<T> = T extends Function ? string : T extends Array<infer U> ? Array<FunctionToString<U>> : T extends object ? { [K in keyof T]: FunctionToString<T[K]> } : T;
export function stringifyFunctions<T>(o: T): FunctionToString<T> {
	if (typeof(o) == 'function') return o.toString() as FunctionToString<T>
	if (Array.isArray(o)) return o.map(stringifyFunctions) as FunctionToString<T>
	if (typeof(o) == 'object') {
		const r = {} as any;
		for (const k in o) r[k] = stringifyFunctions(o[k])
		return r;
	}
	return o as FunctionToString<T>
}

export function uniq<T>(l: T[]): T[] {return  Array.from(new Set(l)).sort() }
