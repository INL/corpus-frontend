import CqlAutocompletionProvider from '@/components/cql-editor/AutocompletionProvider';
import { cqlLexer as Lexer } from '@/components/cql-editor/parser/cqlLexer';
import { ATNSimulator, BaseErrorListener, CharStream, RecognitionException, Recognizer, Token } from 'antlr4ng';
import {languages, editor} from 'monaco-editor';

export class CqlState implements languages.IState {
	clone() { return new CqlState(); }

	equals(other: languages.IState): boolean {
		return true;
	}
}

// make sure these have the same number of capture groups, and that the groups are not optional! (no '?' after the group, but '*' inside the group works)
const dependencyOperatorRegex = /(-|!-|\^-)([^->]*|[^-]*-[^>]*?)(->)([A-Za-z_\-0-9]*)/;
const alignmentOperatorRegex = /(=)([^=>]*|[^=]*=[^>]*?)(=>)([A-Za-z_\-0-9]*)/;
function unpackArrowOperator(input: Token, exp: RegExp, output: languages.IToken[], prefix: 'DEP' | 'ALIGNMENT') {
	const inputstring = input.text!;
	let startIndex = input.column;
	const [match, startOfArrow, infix, endOfArrow, target] = inputstring.match(exp)!;

	// start of the arrow
	output.push({scopes: prefix +'_OP.cql', startIndex});
	startIndex += startOfArrow.length; // can be ^- or - or !-, for example. (root operation, negation)

	// TODO we could lex this as a regex
	if (infix) {
		output.push({scopes: prefix +'_NAME.cql', startIndex});
		startIndex += infix.length;
		// end of the arrow (only when arrow is split by the infix)
		output.push({scopes: prefix +'_OP.cql', startIndex});
	}
	// also do this when there is no infix, then start + end are output as single token
	startIndex += endOfArrow.length;

	if (target) {
		output.push({scopes: prefix +'_TARGET.cql', startIndex});
		startIndex += target.length;
	}
	return output;
}

export class CqlTokensProvider implements languages.TokensProvider {
	getInitialState(): languages.IState {
		return new CqlState();
	}
	tokenize(line: string, state: languages.IState): languages.ILineTokens {
		let errorStartingPoints: number[] = [];
		class ErrorCollectorListener extends BaseErrorListener {
			syntaxError<S extends Token, T extends ATNSimulator>(recognizer: Recognizer<T>, offendingSymbol: S | null, line: number, column: number, msg: string, e: RecognitionException | null): void {
				errorStartingPoints.push(column);
			}
		}

		const lexer = new Lexer(CharStream.fromString(line));
		lexer.removeErrorListeners(); // remove the default console.error listener
		lexer.addErrorListener(new ErrorCollectorListener());
		const output: languages.IToken[] = [];

		for (let token = lexer.nextToken(); token.type != Lexer.EOF; token = lexer.nextToken()) {
			// let's unpack some compound tokens
			switch (token.type) {
				case Lexer.DEP_OP:
				case Lexer.ROOT_DEP_OP:
					unpackArrowOperator(token, dependencyOperatorRegex, output, 'DEP');
					break;
				case Lexer.ALIGNMENT_OP:
					unpackArrowOperator(token, alignmentOperatorRegex, output, 'ALIGNMENT');
					break;
				case Lexer.SINGLE_LINE_COMMENT:
				case Lexer.MULTI_LINE_COMMENT:
					output.push({scopes: 'COMMENT.cql', startIndex: token.column});
					break;

				case Lexer.EQUALS:
				case Lexer.NOT_EQUALS:
				case Lexer.GREATER_THAN:
				case Lexer.LESS_THAN:
				case Lexer.GREATER_THAN_OR_EQUAL:
				case Lexer.LESS_THAN_OR_EQUAL:
				case Lexer.AND:
				case Lexer.OR:
				case Lexer.NOT:
				case Lexer.COLON:
				case Lexer.STAR:
				case Lexer.PLUS:
				case Lexer.QUESTION:
				case Lexer.COMMA:
				case Lexer.SEMICOLON:
					output.push({scopes: 'COMPARATOR.cql', startIndex: token.column});
					break;
				default: {
					let tokenTypeName = lexer.symbolicNames[token.type];
					output.push({scopes: tokenTypeName + '.cql', startIndex: token.column}); // scopes is the id of the token, which we use in the theme for syntax highlighting.
					break;
				}
			}
		}

		// Add all errors
		for (let e of errorStartingPoints) {
			output.push({scopes: 'error.cql', startIndex: e});
		}
		output.sort((a, b) => (a.startIndex > b.startIndex) ? 1 : -1)
		return {
			tokens: output,
			// TODO use endstate to keep track of multiline comments, etc.
			// need to figure out how to pass that info to the lexer though.
			endState: new CqlState()
		}
	}
}

// Uhh, this needs some work.
const c = {
	error: '#ff0000',

	keyword: '#626080',
	identifier: '#f0a331',
	string: '#abdf6a',
	comment: '#ff85ef',

	relation_op: '#72bbff',
	relation_string: '#86edff',

	dep_op: '#ff98fc',
	dep_string: '#bf98ff',

	default_value: '#DDDDDD',

	comparator: '#ebebeb',
}

let color = '#aabbcc';

export function setup() {
	languages.register({ id: 'cql' });
	languages.setTokensProvider('cql', new CqlTokensProvider());
	languages.registerCompletionItemProvider('cql', new CqlAutocompletionProvider());
	editor.defineTheme('cql', {
		base: 'vs-dark',
		inherit: false,
		colors: {},
		rules: [
			// token here refers to the 'scopes' property of the tokens we create above in the tokensForLine function. Basically an identifier for which type of token this is.
			// We suffix them with 'cql' to avoid conflicts with other languages.
			{ token: 'error.cql',					foreground: c.error },
			{ token: 'null.cql',					foreground: c.error }, // unmatched tokens, probably should amend the grammar to catch these

			{ token: 'WITHIN.cql',					foreground: c.keyword },
			{ token: 'CONTAINING.cql',				foreground: c.keyword },
			{ token: 'FLAGS.cql',					foreground: c.keyword},

			{ token: 'NAME.cql',					foreground: c.identifier },


			// relations: see unpackArrowOperator
			{ token: 'DEP_NAME.cql',				foreground: c.dep_string},
			{ token: 'DEP_TARGET.cql',				foreground: c.dep_string},
			{ token: 'DEP_OP.cql',					foreground: c.dep_op, fontStyle: 'bold'},

			{ token: 'ALIGNMENT_NAME.cql',			foreground: c.relation_string},
			{ token: 'ALIGNMENT_TARGET.cql',		foreground: c.relation_string},
			{ token: 'ALIGNMENT_OP.cql',			foreground: c.relation_op, fontStyle: 'bold'},


			{ token: 'DEFAULT_VALUE.cql',			foreground: c.default_value},
			{ token: 'LBRACKET.cql',				foreground: c.default_value},
			{ token: 'RBRACKET.cql',				foreground: c.default_value},

			{ token: 'QUOTED_STRING.cql',			foreground: c.string},
			{ token: 'SINGLE_QUOTED_STRING.cql',	foreground: c.string},

			{ token: 'COMMENT.cql',					foreground: c.comment },

			{ token: 'COMPARATOR.cql',				foreground: c.comparator}
		],
	})
}

