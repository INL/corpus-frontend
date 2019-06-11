import Vue from 'vue';

// just for whatever metadata might be needed here.
import { FilterValue, FilterDefinition } from '@/types/apptypes';
import { MapOf } from '@/utils';

const baseFilter = Vue.extend({
	props: {
		definition: {
			type: Object as () => FilterDefinition,
			required: true
		},
		// you should probably set a default value in the extended component.
		value: undefined as any as () => any,
		textDirection: {
			type: String as () => 'ltr'|'rtl',
			required: true
		},
	},
	methods: {
		// Implemented as multiple events because our value is a prop
		// and thus computing lucene is a second event (value out through event -> value in through prop -> lucene out)
		e_input(value: any) { this.$emit('change-value', value); },
		e_changelucene(lucene: string|null) { this.$emit('change-lucene', lucene); },
		e_changelucenesummary(summary: string|null) { this.$emit('change-lucene-summary', summary); },

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

		luceneQuery(): string|null { throw new Error('missing luceneQuery() implementation in filter'); },
		luceneQuerySummary(): string|null { throw new Error('missing luceneQuerySummary implementation in filter'); }
	},
	watch: {
		luceneQuery(v: string|null) { this.e_changelucene(v); },
		luceneQuerySummary(v: string|null) { this.e_changelucenesummary(v); },
	},
});

export default baseFilter;
