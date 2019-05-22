<template>
	<div
		class="form-group filterfield"
		:id="id"
		:data-filterfield-type="uiType"
	>
		<label class="col-xs-12" :for="inputId">{{displayName}}</label>
		<div class="col-xs-12">
			<input
				type="text"
				class="form-control"
				autocomplete="off"

				:id="inputId"
				:placeholder="displayName"
				:dir="textDirection"
				:value="value"

				@input="e_input"

				ref="autocomplete"
			/>
		</div>
	</div>
</template>


<script lang="ts">
import BaseFilter from '@/components/filters/Filter.vue';
// @ts-ignore
import Autocomplete from '@/mixins/autocomplete';

import {paths} from '@/api';
import { escapeLucene } from '@/utils';
import { FilterValue } from '../../types/apptypes';

export default BaseFilter.extend({
	mixins: [Autocomplete],
	props: {
		value: {
			type: String,
			required: true,
			default: ''
		}
	},
	computed: {
		autocompleteUrl(): string { return this.definition.metadata as string; },

		luceneQuery(): string|undefined {
			const value = this.value as string; // typescript helper

			if (!value || !value.trim()) {
				return undefined;
			}

			const resultParts = [] as string[];
			const quotedParts = value.split(/"/);
			let inQuotes = false;
			for (let part of quotedParts) {
				if (inQuotes && part.match(/\s+/)) {
					// Inside quotes and containing whitespace.
					// Preserve the quotes, they will implicitly escape every special character inside the string
					// NOTE: wildcards do not work for phrases anyway. (https://lucene.apache.org/core/2_9_4/queryparsersyntax.html#Wildcard%20Searches)
					resultParts.push(' "');
					resultParts.push(part);
					resultParts.push('"');
				} else {
					// Outside quotes. Split on whitespace and escape (excluding wildcards) the strings
					// This means wildcards are preserved.
					// NOTE: we need to account for this by checking whether any term contains whitespace
					// while deserializing the lucene query, and reverse this escaping.
					// This is done in UrlStateParser
					part = part.trim();
					if (part.length > 0) {
						// resultParts.push(' "');
						resultParts.push(...part.split(/\s+/).map(escapeLucene));
						// resultParts.push(part.split(/\s+/).join('" "'));
						// resultParts.push('" ');
					}
				}
				inQuotes = !inQuotes;
			}

			return `${this.id}:(${resultParts.join('').trim()})`;
		},

		luceneQuerySummary(): string|undefined {
			const value = this.value && this.value.trim() as string|undefined;
			return value ? `["${value.split(/"/).filter(v => !!v).join('", "')}"]` : undefined;
		}
	},
	methods: {
		autocompleteSelected(value: string) { this.e_input(value); },
	},
	watch: {
		initialLuceneState: {
			immediate: true,
			handler(filters: FilterValue[]|undefined) {
				if (!filters || !filters.length) {
					this.e_input(undefined);
					return;
				}

				const v = filters.find(f => f.id === this.id);
				if (!v || !v.values.length) {
					this.e_input(undefined);
					return;
				}

				this.e_input(v.values[0]);
			}
		}
	},
});
</script>

<style lang="scss">

</style>