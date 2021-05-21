import { MapOf, unescapeLucene, escapeLucene, splitIntoTerms, mapReduce } from '@/utils';
import { FilterValue, Option } from '@/types/apptypes';
import { ASTNode, ASTRange } from 'lucene-query-parser';
// @ts-ignore (framework limitation) typechecking does not work for imports from .vue files
import { modes } from './FilterRangeMultipleFields.vue';
import { FullFilterState } from '@/store/search/form/filters';
import { debugLog } from '@/utils/debug';

type FilterValueFunctions<M, V> = {
	/**
	 * Called once for every filter in the interface
	 * Custom filters are called first.
	 * If a custom filter wants to take "ownership" of a decoded filter value, it should delete the value from the map, to prevent
	 * later (inbuilt) filters from decoding it.
	 */
	decodeInitialState(id: string, filterMetadata: M, filterValues: MapOf<FilterValue|undefined>, ast: ASTNode): V|null,
	luceneQuery(id: string, filterMetadata: M, value: V|null): string|null;
	luceneQuerySummary(id: string, filterMetadata: M, value: V|null): string|null;
}

function getFieldValues(ast: ASTNode, field1: string, field2: string): {
	field1: {
		low: string,
		high: string,
	},
	field2: {
		low: string,
		high: string;
	},
	mode: 'permissive'|'strict';
}|null {
	function isRange(n: any): n is ASTRange {
		return  !!(n && 'field' in n && 'term_min' in n);
	}

	/**
	 * search for a construct like
	 * - (lower:[low TO high] or higher:[low TO high])
	 * - (lower:[low TO high] and higher:[low TO high])
	 *
	 * it looks like this in the ast
	 *
	 * ```javacript
	 * {
	 *   field: <implicit>
	 *   operator: 'AND'|'OR'
	 *   left: {
	 *     field: lower/higher
	 *     term_min: 0
	 *     term_max: 100
	 *     inclusive: true
	 *   }
	 *   right: {
	 *     field: lower/higher
	 *     term_min: 0
	 *     term_max: 100
	 *     inclusive: true
	 *   }
	 * }
	 * ```
	 */

	const stack: ASTNode[] = [ast];
	while (stack.length) {
		const cur = stack.shift()!;
		if (cur.field) {
			// attached to a field, we're looking for a node describing a logical group,
			// like (fieldA:a OR fieldB:b), so it will never have a single field
			continue;
		}

		// terminating clause
		if (
			(isRange(cur.left) && (cur.left.field === field1 || cur.left.field === field2)) &&
			(isRange(cur.right) && (cur.right.field === field1 || cur.right.field === field2))
		) {
			const f1 = cur.left.field === field1 ? cur.left : cur.right;
			const f2 = cur.left.field === field2 ? cur.left : cur.right;
			return {
				field1: {
					// Strip leading zeroes we may have inserted
					low: f1.term_min.replace(/^0*/, ''),
					high: f1.term_max.replace(/^0*/, '')
				},
				field2: {
					// Strip leading zeroes we may have inserted
					low: f2.term_min.replace(/^0*/, ''),
					high: f2.term_max.replace(/^0*/, '')
				},
				mode:
					cur.operator === '&&' ? 'strict' :
					cur.operator === 'AND' ? 'strict' :
					cur.operator === '||' ? 'permissive' :
					cur.operator === 'OR' ? 'permissive' :
					'permissive', // unknown operator -- just interpret as permissive.
			};
		}

		// descend recursively down left and right
		if (cur.left && 'operator' in cur.left) {
			stack.push(cur.left);
		}

		if (cur.right && 'operator' in cur.right) {
			stack.push(cur.right);
		}
	}
	return null;
}


function cast<T>(t: T): T { return t; }

function filterRangeMultipleFields_luceneQuery(id: string, filterMetadata: {low: string, high: string}, value: { low: string; high: string; mode: keyof typeof modes}|null): string|null {
	if (!value) { return null; }
	const {low, high} = filterMetadata;

	// pad using leading zeroes, for when the field is a string in lucene/bls, otherwise field:[1 TO 2] matches anything containing a 1 or 2
	const ll = value.low.padStart(4, '0');
	const lh = value.high.padStart(4, '0');

	const hl = value.low.padStart(4, '0');
	const hh = value.high.padStart(4, '0');

	const op = modes[value.mode as keyof typeof modes].operator;

	return (value.low && value.high) ? `(${low}:[${ll} TO ${lh}] ${op} ${high}:[${hl} TO ${hh}])` : null;
}

export const valueFunctions: MapOf<FilterValueFunctions<any, any>> = {
	'filter-autocomplete': cast<FilterValueFunctions<never, string>>({
		decodeInitialState(id, filterMetadata, filterValues) {
			return (filterValues[id]?.values || []).map(unescapeLucene).map(val => val.match(/\s+/) ? `"${val}"` : val).join(' ') || null;
		},
		luceneQuery(id, filterMetadata, value) {
			if (!value || !value.trim()) { return null; }
			return `${id}:(${splitIntoTerms(value, true).map(t => escapeLucene(t.value, !t.isQuoted)).join(' ')})`;
		},
		luceneQuerySummary(id, filterMetadata, value) {
			const split = value ? splitIntoTerms(value, true) : [];
			return split.map(t => (t.isQuoted || split.length > 1) ? `"${t.value}"` : t.value).join(', ') || null;
		}
	}),
	'filter-checkbox': cast<FilterValueFunctions<Option[], MapOf<boolean>>>({
		decodeInitialState(id, filterMetadata, filterValues) {
			const availableValues = filterValues[id]?.values
				?.map(unescapeLucene)
				.filter(value => { 
					const valueIsPossible = filterMetadata.find(option => option.value === value);
					if (!valueIsPossible) { debugLog(`Filter ${id} ignoring requested value ${value} while decoding - value is not in the available options.`); }
					return valueIsPossible;
				});
			
			return availableValues?.length ? mapReduce(availableValues) : null;
		},
		luceneQuery(id, filterMetadata, value) {
			const selected = Object.entries(value || {})
					.filter(([value, isSelected]) => isSelected)
					.map(([value, isSelected]) => escapeLucene(value, false));
			return selected.length ? `${id}:(${selected.map(v => escapeLucene(v, false)).join(' ')})` : null;
		},
		luceneQuerySummary(id, filterMetadata, value) {
			const selected = Object.entries(value || {})
				.filter(([value, isSelected]) => isSelected)
				.map(([value, isSelected]) => filterMetadata.find(option => option.value === value)?.label || value);

			return selected.length >= 2 ? selected.map(v => `"${v}"`).join(', ') : selected[0] || null;
		}
	}),
	'filter-radio': cast<FilterValueFunctions<Option[], string>>({
		decodeInitialState(id, filterMetadata, filterValues) {
			const availableValues = filterValues[id]?.values
				?.map(unescapeLucene)
				.filter(value => { 
					const valueIsPossible = filterMetadata.find(option => option.value === value);
					if (!valueIsPossible) { debugLog(`Filter ${id} ignoring requested value ${value} while decoding - value is not in the available options.`); }
					return valueIsPossible;
				});
			
			return availableValues?.length ? availableValues[0] : null;
		},
		luceneQuery(id, filterMetadata, value) {
			return value ? `${id}:(${escapeLucene(value, false)})` : null;
		},
		luceneQuerySummary(id, filterMetadata, value) {
			return filterMetadata.find(option => option.value === value)?.label || value || null;
		}
	}),
	'filter-range': cast<FilterValueFunctions<never, { low: string; high: string; }>>({
		decodeInitialState(id, filterMetadata, filterValues) {
			const v = filterValues[id];
			if (!v || !v.values.length) { return null; }
			return {
				low: v.values[0] !== '0' ? v.values[0] || '' : '',
				high: v.values[1] !== '9999' ? v.values[1] || '' : '',
			};
		},
		luceneQuery(id, filterMetadata, value) {
			if (!value) return null;
			return (value.low || value.high) ?
				`${id}:[${value.low || '0'} TO ${value.high || '9999'}]` :
				null;
		},
		luceneQuerySummary(id, filterMetadata, value) {
			return (value && (value.low != null || value.high != null)) ? `${value.low || '0'} - ${value.high || '9999'}` : null;
		}
	}),
	'filter-range-multiple-fields': cast<FilterValueFunctions<{low: string, high: string}, {low: string, high: string, mode: 'permissive'|'strict'}>>({
		decodeInitialState(id, filterMetadata, filterValues, ast) {
			const {low, high} = filterMetadata;
			const s = getFieldValues(ast, low, high);
			// Prevent these fields from also being decoded by another filter later in the decoding stage.
			// Otherwise the values would "double up".
			// https://github.com/INL/corpus-frontend/issues/379
			if (filterValues[low] && filterValues[high]) {
				delete filterValues[low];
				delete filterValues[high];
			}
			return s ? {
				low: s.field1.low,
				high: s.field2.high,
				mode: s.mode
			} : null;
		},
		luceneQuery: filterRangeMultipleFields_luceneQuery,
		luceneQuerySummary(id, filterMetadata, value) {
			const lowValue = value!.low;
			const highValue = value!.high;
			// We need to pad shorter the values with leading zeroes or lucene will behave strangely
			// as they're usually indexed as text values, and not numeric values
			const longestValue = Math.max(lowValue.length, highValue.length);

			const luceneQuery = filterRangeMultipleFields_luceneQuery(id, filterMetadata, value);
			return luceneQuery ? `${lowValue.padStart(longestValue, '0')}-${highValue.padStart(longestValue, '0')}` : null;
		}
	}),
	'filter-select': cast<FilterValueFunctions<Option[], string[]>>({
		decodeInitialState(id, filterMetadata, filterValues) {
			const availableValues = filterValues[id]?.values
				?.map(unescapeLucene)
				.filter(value => { 
					const valueIsPossible = filterMetadata.find(option => option.value === value);
					if (!valueIsPossible) { debugLog(`Filter ${id} ignoring requested value ${value} while decoding - value is not in the available options.`); }
					return valueIsPossible;
				});
			
			return availableValues?.length ? availableValues : null;
		},
		luceneQuery(id, filterMetadata, value) {
			return (value && value.length) ? `${id}:(${value.map(v => escapeLucene(v, false)).join(' ')})` : null;
		},
		luceneQuerySummary(id, filterMetadata, value) {
			const asDisplayValues = (value || []).map(v => {
				const option = filterMetadata.find(option => option.value === v);
				return option && option.label ? option.label : v;
			});
			return asDisplayValues.length >= 2 ? asDisplayValues.map(v => `"${v}"`).join(', ') : asDisplayValues[0] || null;
		}
	}),
	'filter-text': cast<FilterValueFunctions<never, string>>({
		decodeInitialState(id, filterMetadata, filterValues) {
			return (filterValues[id]?.values || []).map(unescapeLucene).map(val => val.match(/\s+/) ? `"${val}"` : val).join(' ') || null;
		},
		luceneQuery(id, filterMetadata, value) {
			if (!value || !value.trim()) { return null; }
			return `${id}:(${splitIntoTerms(value, true).map(t => escapeLucene(t.value, !t.isQuoted)).join(' ')})`;
		},
		luceneQuerySummary(id, filterMetadata, value) {
			const split = value ? splitIntoTerms(value, true) : [];
			return split.map(t => (t.isQuoted || split.length > 1) ? `"${t.value}"` : t.value).join(', ') || null;
		}
	})
}

/**
 * Converts the active filters into a parameter string blacklab-server can understand.
 *
 * Values from filters with types other than 'range' or 'select' will be split on whitespace and individual words will be surrounded by quotes.
 * Effectively transforming
 * "quoted value" not quoted value
 * into
 * "quoted value" "not" "quoted" "value"
 *
 * The result of this is that the filter will respond to any value within one set of quotes, so practially an OR on individual words.
 *
 * If the array is empty or null, undefined is returned,
 * so it can be placed directly in the request paremeters without populating the object if the value is not present.
 */
 export function getFilterString(filters: FullFilterState[]): string|undefined {
	return filters
		.map(f => valueFunctions[f.componentName].luceneQuery(f.id, f.metadata, f.value))
		.filter(lucene => !!lucene).join(' AND ') || undefined;
}

// NOTE: range filter has hidden defaults for unset field (min, max), see https://github.com/INL/corpus-frontend/issues/234
export const getFilterSummary = (filters: FullFilterState[]): string|undefined => filters
	.map(f => ({f, summary: valueFunctions[f.componentName].luceneQuerySummary(f.id, f.metadata, f.value)}))
	.filter(f => !!f.summary)
	.map(f => `${f.f.displayName}: ${f.summary}`)
	.join(', ') || undefined;
