export function shuffle_array(array0) { // in utils zetten ofzo
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

export function log_error(error) {
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

export function stringifyFunctions(o) {
	if (typeof(o) == 'function') return o.toString()
	if (Array.isArray(o)) return o.map(stringifyFunctions)
	if (typeof(o) == 'object') {
		const r = {};
		for (const k in o) r[k] = stringifyFunctions(o[k])
		return r;
	}
	return o
}

export function uniq(l) {return  Array.from(new Set(l)).sort() }
