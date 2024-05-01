import {cqlLexer as Lexer} from './parser/cqlLexer';
import {cqlParser as Parser, QueryContext} from './parser/cqlParser';
import { cqlListener as Listener} from './parser/cqlListener';

import { CharStream, CommonTokenStream, BaseErrorListener as ErrorListener, ParseTree, TerminalNode } from "antlr4ng";
import { CandidatesCollection, CodeCompletionCore } from 'antlr4-c3';
import { CancellationToken, Position, editor, languages } from 'monaco-editor';

// See https://tomassetti.me/code-completion-with-antlr4-c3/


function processCandidates(candidates: CandidatesCollection, parser: Parser, position: Position): languages.CompletionItem[] {
	const suggestions = [] as languages.CompletionItem[];

	// followingTokens is I think a list of tokens that can follow the current token (or a list that will always follow the current token, not sure). usually it's undefined
	for (const [tokenId, followingTokens] of candidates.tokens) {

		const tokenTypeName = parser.vocabulary.getSymbolicName(tokenId);
		console.log({
			tokenId,
			tokenTypeName,
		})

		if (tokenTypeName) suggestions.push({
			kind: languages.CompletionItemKind.Text,
			label: tokenTypeName,
			insertText: tokenTypeName,
			range: {
				// todo this is wrong, we need to get the start and end of the token
				startLineNumber: position.lineNumber,
				startColumn: position.column,
				endLineNumber: position.lineNumber,
				endColumn: position.column,
			}
		});
		// const tokenName = parser.vocabulary.getSymbolicName(tokenType)!.toLowerCase();


	}
	for (const [number, list] of candidates.rules) {
		for (const rule of list.ruleList) {
			const ruleName = parser.ruleNames[rule].toLowerCase();
			switch (rule) {
				case Parser.RULE_annotName:
					suggestions.push({
						kind: languages.CompletionItemKind.Text,
						label: 'Annotation',
						insertText: 'Annotation_name_here',
						range: {
							startLineNumber: position.lineNumber,
							startColumn: position.column,
							endLineNumber: position.lineNumber,
							endColumn: position.column,
						}
					});
					break;
				case Parser.RULE_tagName:
					suggestions.push({
						kind: languages.CompletionItemKind.Text,
						label: 'Tag',
						insertText: 'Tag_name_here',
						range: {
							startLineNumber: position.lineNumber,
							startColumn: position.column,
							endLineNumber: position.lineNumber,
							endColumn: position.column,
						}
					});
					break;
				// case Parser.
				default:
					suggestions.push({
						kind: languages.CompletionItemKind.Text,
						label: ruleName,
						insertText: ruleName,
						range: {
							startLineNumber: position.lineNumber,
							startColumn: position.column,
							endLineNumber: position.lineNumber,
							endColumn: position.column,
						}
					});
					break;
			}
		}
	}

	return suggestions;
}


function computeTokenIndex(parseTree: ParseTree, caretPosition: Position): number|undefined {
	if(parseTree instanceof TerminalNode) {
		return computeTokenIndexOfTerminalNode(parseTree, caretPosition);
	} else {
		return computeTokenIndexOfChildNode(parseTree, caretPosition);
	}
}

function computeTokenIndexOfTerminalNode(parseTree: TerminalNode, caretPosition: Position) {
	// let start = parseTree.symbol.charPositionInLine;
	// let stop = parseTree.symbol.charPositionInLine + parseTree.text.length;


	// correct for caret position being 1-indexed in monaco, and 0-indexed in antlr
	// shift antlr column by 1
	let start = (parseTree.symbol.column + 1);
	let stop = (parseTree.symbol.column + 1) + (parseTree.symbol.text?.length ?? 0);

	if (parseTree.symbol.line == caretPosition.lineNumber && start <= caretPosition.column && stop >= caretPosition.column) {
		return parseTree.symbol.tokenIndex;
	} else {
		return undefined;
	}
}
function computeTokenIndexOfChildNode(parseTree: ParseTree, caretPosition: Position) {
	for (let i = 0; i < parseTree.getChildCount(); i++) {
		let index = computeTokenIndex(parseTree.getChild(i)!, caretPosition);
		if (index !== undefined) {
			return index;
		}
	}
	return undefined;
}

type AutocompletionProviderState = { lexer: Lexer, parser: Parser, query: QueryContext };
export default class CqlAutocompletionProvider implements languages.CompletionItemProvider {
	public readonly triggerCharacters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.\\@(".split("");

	private dirty: true;

	// Not sure we need to track state per model, but since we can only set the CompletionItemProvider once globally, I assume it's shared between all models
	private states = new WeakMap<editor.ITextModel, AutocompletionProviderState>();
	private getState(model: editor.ITextModel) {
		if (this.dirty) this.states.set(model, this.setup(model));
		return this.states.get(model)!;
	}

	setup(model: editor.ITextModel): AutocompletionProviderState {
		let lexer: Lexer;
		let parser: Parser;
		let query: QueryContext;
		function create() {
			lexer = new Lexer(CharStream.fromString(model.getValue()));
			parser = new Parser(new CommonTokenStream(lexer));
			query = parser.query();
		}
		model.onDidChangeContent(() => this.dirty = true);
		create();
		// @ts-ignore
		return { lexer, parser, query };
	}


	provideCompletionItems(model: editor.ITextModel, position: Position, context: languages.CompletionContext, token: CancellationToken): languages.ProviderResult<languages.CompletionList> {
		const {lexer, parser, query} = this.getState(model);

		// caret index in absolute terms instead of line+column
		const index = model.getOffsetAt(position);
		const core = new CodeCompletionCore(parser);
		const candidates = core.collectCandidates(index);


		console.log(candidates);
		const suggestions = processCandidates(candidates, parser, position);
		console.log(model.getValue(), suggestions);
		return {suggestions};
	}
}