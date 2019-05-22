<script lang="ts">
import Vue from 'vue';

// just for whatever metadata might be needed here.
import * as CorpusStore from '@/store/search/corpus';
import { FilterValue, NormalizedAnnotation, FilterDefinition } from '../../types/apptypes';

const baseFilter = Vue.extend({
	props: {
		id: String,
		corpusStore: Object as () => typeof CorpusStore,
		definition: Object as () => FilterDefinition,

		// you should probably set a default value in the extended component.
		value: undefined as any as () => any, // any is a bit weird to define
		initialLuceneState: Array as () => FilterValue[]|undefined,
	},
	methods: {
		// Implemented as multiple events because our value is a prop
		// and thus computing lucene is a second event (value out through event -> value in through prop -> lucene out)
		e_input(value: any) { this.$emit('change-value', value); },
		e_changelucene(lucene: string|undefined) { this.$emit('change-lucene', lucene); },
		e_changelucenesummary(summary: string|undefined) { this.$emit('change-lucene-summary', summary); },
	},
	computed: {
		_originalAnnot(): NormalizedAnnotation|undefined {
			const annots = this.corpusStore.get.annotationsMap()[this.id];
			return (annots && annots[0]) ? annots[0] : undefined;
		},
		id(): string { return this.definition.id; },
		inputId(): string { return `${this.id}_value`; },
		displayName(): string { return this.definition.displayName || this.definition.id; },
		description(): string|undefined { return this.definition.description; },
		textDirection(): string { return this.corpusStore.get.textDirection(); },

		luceneQuery(): string|undefined { throw new Error('missing luceneQuery() implementation in filter'); },
		luceneQuerySummary(): string|undefined { throw new Error('missing luceneQuerySummary implementation in filter'); }
	},
	watch: {
		initialLuceneState: {
			immediate: true,
			handler(filters: FilterValue[]|undefined) {
				throw new Error('missing initialLuceneState() watcher/deserializer implementation in filter');
			}
		},
		luceneQuery(v: string|undefined) { this.e_changelucene(v); },
		luceneQuerySummary(v: string|undefined) { this.e_changelucene(v); },
	},
});

export default baseFilter;
</script>