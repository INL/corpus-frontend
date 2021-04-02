import Vue from 'vue';

// just for whatever metadata might be needed here.
import { FilterDefinition } from '@/types/apptypes';

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
		htmlId: String,
		showLabel: {
			type: Boolean,
			default: true
		}
	},
	methods: {
		// Implemented as multiple events because our value is a prop
		// and thus computing lucene is a second event (value out through event -> value in through prop -> lucene out)
		e_input(value: any) { this.$emit('change-value', value); },
	},
	computed: {
		id(): string { return this.definition.id; },
		inputId(): string { return `${this.htmlId}_value`; },
		displayName(): string { return this.definition.displayName || this.definition.id; },
		description(): string|undefined { return this.definition.description; },
	},
});

export default baseFilter;
