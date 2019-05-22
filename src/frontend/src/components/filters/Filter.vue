<script lang="ts">
import Vue from 'vue';

// just for whatever metadata might be needed here.
import * as CorpusStore from '@/store/search/corpus';
import { FilterValue, NormalizedAnnotation, FilterDefinition } from '@/types/apptypes';
import { MapOf } from '@/utils';
import { FilterState } from '@/store/search/form/filters';

export default Vue.extend({
	props: {
		definition: {
			type: Object as () => FilterDefinition,
			required: true
		},
		// you should probably set a default value in the extended component.
		value: {
			type: undefined as any as () => any, // any is a bit weird to define
			required: true,
		},
		textDirection: {
			type: String as () => 'ltr'|'rtl',
			required: true
		},
	},
	methods: {
		// Implemented as multiple events because our value is a prop
		// and thus computing lucene is a second event (value out through event -> value in through prop -> lucene out)
		e_input(value: any) { this.$emit('change-value', value); },
		e_changelucene(lucene: string|undefined) { this.$emit('change-lucene', lucene); },
		e_changelucenesummary(summary: string|undefined) { this.$emit('change-lucene-summary', summary); },

		/**
		 * Called on first load, convert the initial query to a valid state for the value prop,
		 * what this looks like is up to the implementation.
		 * When this is called the component will not be mounted, though all props with exception of value will be available.
		 * If the query could not be decoded, the default empty value state should be returned.
		 */
		decodeInitialState(filterValues: MapOf<FilterValue>): any { throw new Error('missing decodeInitialState() implementation in filter'); }
	},
	computed: {
		id(): string { return this.definition.id; },
		inputId(): string { return `${this.id}_value`; },
		displayName(): string { return this.definition.displayName || this.definition.id; },
		description(): string|undefined { return this.definition.description; },

		luceneQuery(): string|undefined { throw new Error('missing luceneQuery() implementation in filter'); },
		luceneQuerySummary(): string|undefined { throw new Error('missing luceneQuerySummary implementation in filter'); }
	},
	watch: {
		luceneQuery(v: string|undefined) { this.e_changelucene(v); },
		luceneQuerySummary(v: string|undefined) { this.e_changelucene(v); },
	},
});
</script>