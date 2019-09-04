<template>
	<div
		class="form-group filterfield"
		:id="id"
		:data-filterfield-type="definition.componentName"
	>
		<label class="col-xs-12" :for="inputId">{{displayName}}</label>
		<div class="col-xs-4">
			<input type="number"
				placeholder="From"
				class="form-control"
				autocomplete="off"

				:id="inputId+'_lower'"
				:value="value.low"

				@input="e_input({low: $event.target.value, high: value.high, mode: value.mode})"
			>
		</div>
		<div class="col-xs-4">
			<input type="number"
				placeholder="To"
				class="form-control"
				autocomplete="off"

				:id="inputId+'_upper'"
				:value="value.high"

				@input="e_input({low: value.low, mode: value.mode, high: $event.target.value})"
			>
		</div>
		<div class="btn-group col-xs-12" style="margin-top: 12px;">
			<button v-for="mode in modes"
				type="button"
				:class="['btn btn-default', {'active': value.mode === mode.value}]"
				:key="mode.value"
				:value="mode.value"
				:title="mode.title"
				@click="e_input({low: value.low, high: value.high, mode: mode.value})"
			>{{mode.label}}</button>
		</div>
	</div>
</template>

<script lang="ts">
import BaseFilter from '@/components/filters/Filter';
import luceneQueryParser from 'lucene-query-parser';

import { escapeLucene, MapOf, unescapeLucene } from '@/utils';
import { FilterValue } from '@/types/apptypes';
import { Option } from '@/components/SelectPicker.vue';

const modes = {
	permissive: {
		id: 'permissive',
		operator: 'OR',
		displayName: 'Permissive',
		description: "Matches documents if either field overlaps with the document's metadata"
	},

	strict: {
		id: 'strict',
		operator: 'AND',
		displayName: 'Strict',
		description: "Matches documents if both fields overlap with the document's metadata"
	}
};

type Mode = keyof typeof modes;

type ValueType = {
	low: string;
	high: string;
	mode: Mode;
};

function getFieldValues(ast: luceneQueryParser.ASTNode, field1: string, field2: string): {
	field1: {
		low: string,
		high: string,
	},
	field2: {
		low: string,
		high: string;
	},
	mode: Mode
}|null {
	function isRange(n: any): n is luceneQueryParser.ASTRange {
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

	const stack: luceneQueryParser.ASTNode[] = [ast];
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
					'permissive', // what is going on here exactly?
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

export default BaseFilter.extend({
	props: {
		value: {
			type: Object as () => ValueType,
			required: true,
			default: () => ({
				low: '',
				high: '',
				mode: 'strict'
			}) as ValueType
		},
	},
	computed: {
		fields(): { low: string, high: string } { return this.definition.metadata; },
		modes(): Option[] {
			return Object.values(modes).map(m => ({
				label: m.displayName,
				title: m.description,
				value: m.id
			}));
		},
		luceneQuery(): string|null {
			const value = this.value as ValueType;
			const lf = this.fields.low;
			// pad using leading zeroes, for when the field is a string in lucene/bls, otherwise field:[1 TO 2] matches anything containing a 1 or 2
			const ll = value.low.padStart(4, '0');
			const lh = value.high.padStart(4, '0');

			const hf = this.fields.high;
			const hl = value.low.padStart(4, '0');
			const hh = value.high.padStart(4, '0');

			const op = modes[this.value.mode as keyof typeof modes].operator;

			return this.value.low && this.value.high ? `(${lf}:[${ll} TO ${lh}] ${op} ${hf}:[${hl} TO ${hh}])` : null;
		},
		luceneQuerySummary(): string|null {
			return this.luceneQuery ? `${this.value.low.padStart(4, '0')}-${this.value.high.padStart(4, '0')}` : null;
		}
	},
	methods: {
		decodeInitialState(filterValues: MapOf<FilterValue>, ast: luceneQueryParser.ASTNode): ValueType|null {
			const s = getFieldValues(ast, this.fields.low, this.fields.high);
			if (s) {
				return {
					low: s.field1.low,
					high: s.field2.high,
					mode: s.mode
				};
			}
			return null;
		}
	}
});
</script>

<style lang="scss">

</style>