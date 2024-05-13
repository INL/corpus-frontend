/** BCQL JSON INTERPRETER:
 *
 * Takes the JSON tree structure returned by BlackLab's /parse-pattern endpoint and
 * interprets it for use in the frontend.
 *
 * This means we don't have to implement a full parser for the BCQL language in the
 * frontend as well, but just rely on BlackLab's parser.
 */

import * as api from '@/api';

export const DEFAULT_ANNOTATION = '__default__';

export type XmlTag = {
	type: 'xml';
	/** xml token name excluding namespace, brackets, attributes etc */
	name: string;
	isClosingTag: boolean;
};

export type Attribute = {
	type: 'attribute';
	/** A word property(/annotatedField) id, such as lemma, pos, word, etc... */
	name: string;
	/** Comparison type, usually '=' or '!=' */
	operator: '='|'!=';
	/** Regex to compare the attribute to */
	value: string;
};

export type BinaryOp = {
	type: 'binaryOp';
	/** typically 'OR', 'AND', '|', '&' */
	operator: string;
	left: BinaryOp|Attribute;
	right: BinaryOp|Attribute;
};

export type Token = {
	leadingXmlTag?: XmlTag;
	trailingXmlTag?: XmlTag;
	expression?: BinaryOp|Attribute;
	optional: boolean;
	repeats?: {
		min: number;
		/** When null, maximum repetitions is unbounded */
		max: number|null;
	};
};

export type Result = {
	tokens: Token[];
	/** xml token name excluding namespace, brackets, attributes etc */
	within?: string;
	targetVersions?: string[];
};

function interpretBcqlJson(json: any, defaultAnnotation: string): Result {
	function _not(clause: any): Attribute {
		if (clause.type !== 'regex') {
			throw new Error('Can only interpret not on regex');
		}
		return {
			type: 'attribute',
			name: clause.annotation || DEFAULT_ANNOTATION,
			operator: '!=',
			value: clause.value
		};
	}

	function _regex(annotation: string, value: string): Attribute {
		return {
			type: 'attribute',
			name: annotation || DEFAULT_ANNOTATION,
			operator: '=',
			value
		};
	}

	function _boolean(type: string, clauses: any[]): BinaryOp {
		return {
			type: 'binaryOp',
			operator: type === 'and' ? '&' : '|',
			left: _tokenExpression(clauses[0]),
			right: _tokenExpression(clauses[1])
		};
	}

	function _tokenExpression(input: any): BinaryOp|Attribute {
		switch (input.type) {
		case 'regex':
			return _regex(input.annotation || defaultAnnotation, input.value);
		case 'not':
			return _not(input.clause);
		case 'and':
		case 'or':
			return _boolean(input.type, input.clauses);
		}
		throw new Error('Unknown token expression type: ' + input.type);
	}

	function _tokenFromTokenExpression(input: any): Token {
		return {
			expression: _tokenExpression(input),
			optional: false
		};
	}

	function _sequence(clauses: any[]): Token[] {
		return clauses.map(_token);
	}

	function _posFilter(producer: any, operation: string, filter: any): Result {
		if (operation !== 'within')
			throw new Error('Unknown posfilter operation: ' + operation);
		if (filter.type !== 'tags')
			throw new Error('Unknown posfilter filter type: ' + filter.type);
		const query = _query(producer);
		query.within = filter.name;
		return query;
	}

	function _repeat(input: any): Token {
		const token = _token(input.clause);
		const min = 'min' in input ? input.min : 1;
		const max = 'max' in input ? input.max : null;
		if (min === 0 && max === 1) {
			token.optional = true;
		} else {
			if (token.repeats)
				throw new Error('Can\'t repeat a repeated token');
			token.repeats = { min, max };
		}
		return token;
	}

	function _token(input: any): Token {
		const tokens = [] as Token[];
		let within: string|undefined;
		let targetVersions: string[]|undefined;

		switch (input.type) {
		case 'anytoken': // [] or []{min,max}
			{
				const min = 'min' in input ? input.min : 1;
				const max = 'max' in input ? input.max : null;
				if (min === 0 && max === 1) {
					return {
						optional: true,
					};
				} else {
					return {
						optional: false,
						repeats: {
							min,
							max,
						},
					};
				}
			}
		case 'repeat':   // {min,max} or ?, *, +
			return _repeat(input);

		default:
			// Excluded any special token-level nodes; must be a token expression
			return {
				expression: _tokenExpression(input),
				optional: false,
			};
		}
	}

	function _query(input: any): Result {
		switch (input.type) {
		case 'sequence':
			return {
				tokens: _sequence(input.clauses),
			};
		case 'posfilter': // (within expression)
			return _posFilter(input.producer, input.operation, input.filter);

		// @@@ TODO JN relations/parallel
		// case 'relmatch':
		// 	tokens.push(relmatch(input.parent, input.children));
		//  break;

		default:
			// Must be a single token
			return {
				tokens: [_token(input)],
			}
		}
	}

	const result = _query(json);
	console.log('RESULT', result);
	return result;
}

async function parseBcql(indexId: string, bcql: string, defaultAnnotation: string): Promise<Result> {
	const response = await api.blacklab.getParsePattern(indexId, bcql);
	return interpretBcqlJson(response.parsed.json, defaultAnnotation);
}

export {
	interpretBcqlJson,
	parseBcql
};
