<template>
	<SelectPicker
		data-class="btn-sm btn-default"
		placeholder="Sort by..."
		data-menu-width="grow"

		allowHtml
		hideDisabled
		allowUnknownValues
		right

		:searchable="sortOptions.searchable"
		:options="sortOptions.options"
		:disabled="disabled"

		v-model="model"
	/>
</template>

<script lang="ts">
import Vue from 'vue';
import { NormalizedIndex } from '@/types/apptypes';
import SelectPicker, { OptGroup } from '@/components/SelectPicker.vue';
import { getAnnotationSubset, getMetadataSubset } from '@/utils';
import debug from '@/utils/debug';

export default Vue.extend({
	components: {
		SelectPicker
	},
	props: {
		hits: Boolean,
		docs: Boolean,
		groups: Boolean,

		value: String,

		corpus: Object as () => NormalizedIndex,
		annotations: Array as () => string[],
		metadata: Array as () => string[],
		disabled: Boolean,
	},
	computed: {
		model: {
			get(): string { return this.value; },
			set(v: string) { this.$emit('input', v); }
		},
		sortOptions(): {
			options: OptGroup[],
			searchable: boolean
		} {
			// NOTE: we need to always pass all available options, then hide invalids based on displayed results
			// if we don't do this, sorting will be cleared on initial page load
			// This happens because results aren't loaded yet, thus isHits/isDocs/isGroups all return false, and no options would be available
			// then the selectpicker will reset value to undefined, which clears it in the store, which updates the url, etc.
			const opts = [] as OptGroup[];

			if (this.groups) {
				opts.push({
					label: 'Groups',
					options: [{
						label: 'Sort by Group Name',
						value: 'identity',
					}, {
						label: 'Sort by Group Name (descending)',
						value: '-identity',
					}, {
						label: 'Sort by Size',
						value: 'size',
					}, {
						label: 'Sort by Size (ascending)',
						value: '-size', // numeric sorting is inverted: https://github.com/INL/corpus-frontend/issues/340
					}]
				});
			}

			if (this.hits) {
				opts.push(...getAnnotationSubset(
					this.annotations,
					this.corpus.annotationGroups,
					this.corpus.annotatedFields.contents.annotations,
					'Sort',
					this.corpus.textDirection,
					debug.debug
				));
			}
			if (this.docs) {
				opts.push({
					label: 'Documents',
					options: [{
						label: 'Sort by hits',
						value: 'numhits'
					}, {
						label: 'Sort by hits (ascending)',
						value: '-numhits' // numeric sorting is inverted: https://github.com/INL/corpus-frontend/issues/340
					}]
				});
			}

			if (!this.groups) {
				opts.push(...getMetadataSubset(
					this.metadata,
					this.corpus.metadataFieldGroups,
					this.corpus.metadataFields,
					'Sort',
					debug.debug
				));
			}

			return {
				options: opts,
				searchable: opts.reduce((a, g) => a + g.options.length, 0) > 12
			};
		},
	}
})
</script>