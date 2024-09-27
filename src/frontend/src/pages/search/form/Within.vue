<template>
	<!-- show this even if it's disabled when "within" contains a value, or you can never remove the value -->
	<!-- this will probably never happen, but it could, if someone imports a query with a "within" clause active from somewhere -->
	<div v-if="withinOptions.length || within" class="form-group">
		<label class="col-xs-12 col-md-3">{{$t('search.extended.within')}}</label>

		<div class="btn-group col-xs-12 col-md-9">
			<button v-for="option in withinOptions"
				type="button"
				:class="['btn', within === option.value ? 'active btn-primary' : 'btn-default']"
				:key="option.value"
				:value="option.value"
				:title="option.title || undefined"
				@click="within = option.value"
			>{{withinOptionDisplayName(option)}}</button> <!-- empty value searches across entire documents -->
		</div>
		<div class="btn-group col-xs-12 col-md-9 col-md-push-3 attr form-inline" v-for="attr in withinAttributes()">
			<label>{{ attr.label || attr.value }}</label>
			<input class='form-control' type="text" :title="attr.title || undefined"
					:value="withinAttributeValue(attr)" @change="changeWithinAttribute(attr, $event)" />
		</div>
	</div>
</template>

<script lang="ts">
import Vue from 'vue';

import * as UIStore from '@/store/search/ui';
import * as PatternStore from '@/store/search/form/patterns';

import { Option } from '@/components/SelectPicker.vue';
import { corpusCustomizations } from '@/store/search/ui';

export default Vue.extend({
	components: {
	},
	computed: {
		withinOptions(): Option[] {
			const {enabled, elements} = UIStore.getState().search.shared.within;
			return enabled ? elements.filter(corpusCustomizations.search.within.include) : [];
		},
		within: {
			get(): string|null {
				const withinClauses = PatternStore.getState().extended.withinClauses;
				return Object.keys(withinClauses).find(w => this.withinOptions.some(o => o.value === w)) || null;
				//return PatternStore.getState().extended.within;
			},
			set(v: string|null) {
				if (v === null)
					return;
				// Ensure only the active within element is part of withinClauses; remove the rest
				const withinClauses = PatternStore.getState().extended.withinClauses;
				this.withinOptions.forEach(o => {
					const isActive = o.value === v;
					if (isActive)
						Vue.set(withinClauses, v, {});
					else
						Vue.delete(withinClauses, v);
				});
				//PatternStore.actions.extended.within(v);
			}
		},
	},
	methods: {
		withinOptionDisplayName(option: Option): string {
			return corpusCustomizations.search.within.displayName(option) || option.label || option.value || 'document';
		},
		withinAttributes(): Option[] {
			const within = this.within;
			if (!within) return [];

			const option = this.withinOptions.find(o => o.value === within);
			if (!option) return [];

			return (corpusCustomizations.search.within.attributes(option) || [])
				.map(el => typeof el === 'string' ? { value: el } : el);
		},
		withinAttributeValue(option: Option) {
			if (this.within === null)
			 	return '';
			return PatternStore.getState().extended.withinClauses[this.within][option.value] || '';
		},
		changeWithinAttribute(option: Option, event: Event) {
			const spanName = this.within;
			if (spanName === null)
				return;
			const el = event.target as HTMLInputElement;
			const curVal = PatternStore.getState().extended.withinClauses[option.value] || {};
			curVal[option.value] = el.value;
			Vue.set(PatternStore.getState().extended.withinClauses, spanName, curVal);
		},
	},
})
</script>

<style lang="scss">

div.attr {
	margin-top: 4px;
	label, input { width: 6em; }
}

</style>
