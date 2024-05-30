/** Group by some tokens at a fixed position in the hit. */
export type ContextPositional = {
	type: 'positional';
	/** B === 'before', H === 'from start of hit', A === 'after hit', E === 'from end of hit (reverse)' */
	position: 'B'|'H'|'A'|'E';
	info: {
		type: 'specific'|'first'|'all',
		/** Unused when type !== 'specific', but for ease of use we make this always exist. */
		start: number,
		/** Unused when type !== 'specific', but for ease of use we make this always exist. */
		end: number,
	}
}
/** Group by a labelled part of the hit. E.G. a:[] or _ a:--> _ */
export type ContextLabel = {
	type: 'label';
	label: string;
}

/** Represents grouping by one or more tokens in the hit */
export type GroupByContext<T extends ContextPositional|ContextLabel = ContextPositional|ContextLabel> = {
	type: 'context',
	annotation: string|undefined,
	caseSensitive: boolean,

	context: T;
}
/** Represents grouping by document metadata */
export type GroupByMetadata = {
	type: 'metadata';
	field: string;
	caseSensitive: boolean;
}
/** Represents grouping by something we don't support. */
export type GroupByCustom = {
	type: 'custom';
	value: string;
}
export type GroupBy = GroupByContext|GroupByMetadata|GroupByCustom;

/**
 * Parse a GroupBy string. It should be pre-separated on comma's.
 * https://inl.github.io/BlackLab/server/rest-api/corpus/hits/get.html#criteria-for-sorting-grouping-and-faceting
 */
export function parseGroupBy(groupBy: string[]): GroupBy[] {
	const cast = <T>(x: T): T => x;
	return groupBy.map<GroupBy>(part => {
		const [type] = part.split(':', 1);

		switch (type) {
			// grouping by metadata
			case 'field': return {
				type: 'metadata',
				field: part.split(':')[1],
				caseSensitive: part.split(':')[2] === 's'
			}
			case 'capture': return cast<GroupByContext>({
				type: 'context',
				annotation: part.split(':')[1],
				caseSensitive: part.split(':')[2] === 's',
				context: {
					type: 'label',
					// label can be either a capture label (a:"word") or a relation (whether explicitly captured or not, e.g. _ a:--> _).
					// but for the relation, all tokens between source and target are used for the grouping
					// so not what we want. Will need new BlackLab feature to support this.
					// probably want to group on the VALUE of the relation itself, not the tokens.
					label: part.split(':')[3]
				}
			})
			case 'hit': return cast<GroupByContext>({
				type: 'context',
				annotation: part.split(':')[1],
				caseSensitive: part.split(':')[2] === 's',
				context: {
					type: 'positional',
					position: 'H',
					info: { type: 'all', start: 1, end: 1 }
				}
			})
			// grouping by words in/around the hit
			case 'left':
			case 'before':
			case 'right':
			case 'after': {
				const [_, annot, caseSensitive, howManyWords] = part.split(':');
				const start = 1; // these always start at 1. The number is just "how many words before or after"
				const end = Number(howManyWords) ;
				const fullContext = isNaN(end);

				return cast<GroupByContext>({
					type: 'context',
					annotation: part.split(':')[1],
					caseSensitive: part.split(':')[2] === 's',
					context: {
						type: 'positional',
						position: (type === 'left' || type === 'before') ? 'B' : 'A',
						info: {
							type: fullContext ? 'all' : 'specific',
							start,
							end,
						}
					},
				});
			}
			case 'wordleft':
			case 'wordright': return cast<GroupByContext>({
				type: 'context',
				annotation: part.split(':')[1],
				caseSensitive: part.split(':')[2] === 's',
				context: {
					type: 'positional',
					position: type === 'wordleft' ? 'B' : 'A',
					info: {
						type: 'specific',
						start: 1,
						end: 1
					}
				}
			});

			// grouping by specific context (e.g. at (a) specific offset(s) within/before/after the hit)
			// these are a bit more complex, and we don't support all options in the UI.
			// when we encounter one we can't parse fully, we'll just returns the parts we can parse.
			case 'context': {
				const [_, annot, caseSensitive, spec] = part.split(':');
				const parsedSpec = spec.match(/(L|R|H|E|B|A)(\d+)-?(\d+)?/);
				if (parsedSpec) { // this can contain more, like ; and a second(+) set of positions. We'll ignore that for now.
					let [_, position, startMaybe, endMaybe] = parsedSpec;
					// right/left -> before/after. Since BL 4
					if (position === 'R') position = 'A';
					if (position === 'L') position = 'B';

					const fullContext = !startMaybe && !endMaybe;
					let start = Number(startMaybe) || 1;
					let end = Number(endMaybe) || 5;

					return cast<GroupByContext>({
						type: 'context',
						annotation: part.split(':')[1],
						caseSensitive: part.split(':')[2] === 's',
						context: {
							type: 'positional',
							position: position as any,
							info: {
								type: fullContext ? 'all' : 'specific',
								start,
								end,
							}
						}
					});
				} // else fallthrough default, which returns the whole part as a string.
			}
			default: {
				console.warn(`Unknown group by type: ${type}`);
				return {
					type: 'custom',
					value: part
				}
			}
		}
	});
}

/** See https://inl.github.io/BlackLab/server/rest-api/corpus/hits/get.html#criteria-for-sorting-grouping-and-faceting */
export function serializeGroupBy(groupBy: GroupBy): string;
export function serializeGroupBy(groupBy: GroupBy[]): string[]
export function serializeGroupBy(groupBy: GroupBy|GroupBy[]): string|string[] {
	function single(g: GroupBy): string {
		switch (g.type) {
			case 'metadata': return `field:${g.field}:${g.caseSensitive ? 's' : 'i'}`;
			case 'context': {

				if (g.context.type === 'label') return `capture:${g.annotation}:${g.caseSensitive ? 's' : 'i'}:${g.context.label}`;
				else if (g.context.type === 'positional') {
					/*
						Examples:
						{ type: 'positional', position: 'B', info: { type: 'specific', start: 1, end: 2 } } ==> 'context:capture:s:B1-2'
						{ type: 'positional', position: 'H', info: { type: 'all' } } ==> 'context:capture:s:H'
						{ type: 'positional', position: 'A', info: { type: 'first' } } ==> 'context:capture:s:A1-1'
					*/

					const info = g.context.info;
					let spec: string = g.context.position; // before, after, hit, end (B,A,H,E)
					if (info.type === 'all') {}
					else if (info.type === 'first') spec += '1-1';
					else if (info.type === 'specific') spec += `${info.start}${info.end ? '-' + info.end : ''}`;
					else {
						// this will start to error compile-time if we ever add a new type.
						function never(x: never): never { throw new Error('Unimplemented context info type: ' + x); }
						never(info.type);
					}

					return `context:${g.annotation}:${g.caseSensitive ? 's' : 'i'}:${spec}`;
				} else {
					// this will start to error compile-time if we ever add a new type.
					function never(x: never): never { throw new Error('Unimplemented context type: ' + x); }
					never(g.context);
				}
			}
			case 'custom': return g.value;
			// @ts-ignore
			default: throw new Error('Unimplemented groupby type: ' + g.type);
		}
	};

	return Array.isArray(groupBy) ? groupBy.map(single) : single(groupBy);
}

export function isValidGroupBy(g: GroupBy): boolean {
	if (!g.type) return false;
	if (g.type === 'metadata' && !g.field) return false;
	if (g.type === 'context') {
		if (!g.annotation) return false;
		if (g.context.type === 'label' && !g.context.label) return false;
		if (g.context.type === 'positional' && !g.context.position) return false;
		if (g.context.type === 'positional' && g.context.info.type === 'specific' && (!g.context.info.start || !g.context.info.end)) return false;
	}
	return true;
}
