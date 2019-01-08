export const DEFAULT_ATTRIBUTE = '__default__';

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
};

const WHITESPACE = [' ', '\t', '\n', '\r'];

export default function(input: string, defaultAttribute = DEFAULT_ATTRIBUTE): Result {

	let pos = 0;
	let cur = '';

	function errorMsg(msg: string) {
		return msg + ' at ' + pos;
	}

	function nextSym() {
		if (++pos >= input.length) {
			cur = '';
		} else {
			cur = input[pos];
		}
	}

	/**
	 * Test current symbol against any number of other symbols
	 * @returns number of characters to advance, 0 if no matches
	 */
	function test(...tests: string[]): number {
		for (const item of tests) {
			let match = true;
			for (let k = 0; k < item.length; k++) {
				if (pos + k >= input.length || input[pos + k] !== item[k]) {
					match = false;
					break;
				}
			}
			if (match) {
				return item.length;
			}
		}
		return 0;
	}

	// If the current symbol matches any of the symbols, advance one symbol
	// skips all whitespace encountered before the symbol unless otherwise stated
	// no whitespace is skipped if the symbol was not encountered
	function accept(sym: string[], keepWhitespace: boolean = false): boolean {
		const originalPos = pos;
		const originalCur = cur;

		if (!keepWhitespace) {
			while (test(...WHITESPACE)) {
				nextSym();
			}
		}

		const accepted = test(...sym);
		if (accepted > 0) {
			// Don't use nextSym(), sym.length might be >1
			pos += accepted;
			cur = input[pos];

			if (!keepWhitespace) {
				while (test(...WHITESPACE)) {
					nextSym();
				}
			}
		} else {
			cur = originalCur;
			pos = originalPos;
		}

		return accepted > 0;
	}

	// Like accept, but throw an error if not at any of the symbols.
	function expect(sym: string, keepWhitespace?: boolean) {
		if (!accept([sym], keepWhitespace)) {
			throw errorMsg('Expected one of [' + sym + '] but found ' + input[pos]);
		}
	}

	// Continue until one of the symbols is encountered,
	// then stop at the encountered symbol and return a substring from where we started and ending at that symbol (exclusive)
	function until(...symbols: string[]) {
		const startPos = pos;
		while (!test(...symbols)) {
			if (pos >= input.length) {
				throw errorMsg('Unexpected end of input, expected one of [' + symbols + ']');
			}
			nextSym();
		}
		const endPos = pos;

		return input.substring(startPos, endPos);
	}

	function parseXmlTag(): XmlTag {
		expect('<');

		const isClosingTag = accept(['/']);

		// keep going until we meet the end of the tag, also break on whitespace as it's not allowed
		const tagName = until(...WHITESPACE, '>');
		expect('>');

		return {
			type: 'xml',
			name: tagName, // todo validate
			isClosingTag
		};
	}

	function parseAttribute(): Attribute {
		const name = until('=', '!').trim(); // This should really be "until anything BUT a-zA-z" but eh
		const operator = until('"').trim();
		expect('"', true); // keep all whitespace after the opening quote
		const value = until('"'); // don't trim whitespace
		expect('"', true); // also keep all whitespace before and after the quote
		while (test(...WHITESPACE)) { nextSym(); } // skip whitespace after quote.

		if (operator !== '=' && operator !== '!=') {
			throw errorMsg('Unknown operator ' + operator);
		}

		return {
			type: 'attribute',
			name,
			operator,
			value
		};
	}

	function parsePredicate(): Attribute|BinaryOp {
		if (accept(['('])) {
			const exp = parseExpression();
			expect(')');
			return exp;
		} else {
			return parseAttribute();
		}
	}

	function parseExpression() {
		let left = parsePredicate();
		while (test('&', '|')) {
			const op = cur;
			nextSym();
			const right = parsePredicate();

			left = {
				type: 'binaryOp',
				operator: op,
				left,
				right
			};
		}

		return left;
	}

	function parseToken(): Token {
		const token = {} as Token;

		if (test('<')) {
			token.leadingXmlTag = parseXmlTag();
		}

		if (accept(['['])) {
			if (!accept([']'])) {
				token.expression = parseExpression();
				expect(']');
			}
		} else { // shorthand is just a single word
			expect('"');
			const word = until('"');
			expect('"');

			token.expression = {
				type: 'attribute',
				name: defaultAttribute,
				operator: '=',
				value: word
			};
		}

		if (accept(['{'])) { // range

			const minRep = parseInt(until(',', '}'), 10);
			let maxRep: number|null = null;

			if (accept([','])) {

				const maxRepString = until('}').trim();
				// {n, } is valid syntax for unbounded repetitions starting at n times
				// signal this by leaving maxRep as null
				if (maxRepString.length > 0) {
					maxRep = parseInt(maxRepString, 10);
				}

				expect('}');
			} else {
				maxRep = minRep;
				expect('}');
			}

			if (isNaN(minRep)) {
				throw errorMsg('minRepeats is not a number');
			}
			if (maxRep !== null && isNaN(maxRep)) {
				throw errorMsg('maxRepeats is not a number');
			}

			token.repeats = {
				min: minRep,
				max: maxRep,
			};
		} else if (accept(['?'])) {
			token.optional = true;
		}

		if (test('<')) {
			token.trailingXmlTag = parseXmlTag();
			if (!token.trailingXmlTag.isClosingTag) {
				throw errorMsg('Token is followed by xml tag but it\'s an opening tag');
			}
		}

		return token;
	}

	function parseWithin() {
		expect('within');

		expect('<');
		const elementName = until('/', ...WHITESPACE); // break on whitespace, since whitespace in the <tag name/> is illegal
		expect('/'); // self closing tag (<tag/>)
		expect('>');
		return elementName;
	}

	if (typeof input !== 'string' || (input = input.trim()).length === 0) {
		return {
			tokens: [],
		};
	}

	pos = 0;
	cur = input[0];

	const tokens = [] as Token[];
	let within: string|undefined;

	// we always start with a token
	tokens.push(parseToken());
	while (pos < input.length) {
		if (test('within')) {
			within = parseWithin();
		} else {
			tokens.push(parseToken());
		}
	}

	return {
		tokens,
		within
	};
}
