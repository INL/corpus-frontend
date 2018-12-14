<template>
	<div class="row">
		<div class="col-xs-12">
			<h3>Explore ...</h3>
			<ul class="nav nav-tabs">
				<li :class="{'active': exploreMode==='ngram'}"     @click.prevent="exploreMode='ngram'"><a href="#explore-n-grams">N-grams</a></li>
				<li :class="{'active': exploreMode==='frequency'}" @click.prevent="exploreMode='frequency'"><a href="#explore-frequency">Statistics</a></li>
			</ul>

			<div class="tab-content">
				<form
					id="explore-n-grams"
					:class="['tab-pane form-horizontal', {'active': exploreMode==='ngram'}]"

					@submit.prevent.stop="submitNgram"
					@reset.prevent.stop="resetNgram"
				>
					<div class="form-group">
						<label class="col-xs-4 col-md-2" for="n-gram-size">N-gram size</label>
						<div class="col-xs-8 col-md-5">
							<input
								class="form-control"
								name="n-gram-size"
								id="n-gram-size"

								type="number"
								min="1"
								:max="ngramSizeMax"

								v-model.number="ngramSize"
							/>
						</div>
					</div>
					<div class="form-group">
						<label class="col-xs-4 col-md-2" for="n-gram-type">N-gram type</label>

						<div class="col-xs-8 col-md-5">
							<SelectPicker
								id="n-gram-type"
								name="n-gram-type"

								data-width="100%"

								:options="annotationOptions"

								v-model="ngramType"
							/>
						</div>
					</div>

					<div class="n-gram-container">
						<div v-for="(token, index) in ngramTokens" :key="index" class="n-gram-token">
							<SelectPicker
								data-width="100%"

								:class="{'disabled': index >= ngramSize}"
								:options="annotationOptions"
								:disabled="index >= ngramSize"
								:value="token.id"

								@change="updateTokenAnnotation(index, $event /* custom component - custom event values */)"
							/>
							<input
								class="form-control"
								type="text"

								:disabled="index >= ngramSize"
								:value="token.value"

								@change="updateTokenValue(index, $event.target.value /* native component - native event */)"
							/>
						</div>
					</div>
					<hr>
					<div class="row">
						<Filters id="n-grams-filtercontainer" class="col-md-9"/>
					</div>
					<hr>
					<button type="submit" class="btn btn-primary btn-lg">Search</button>
					<button type="reset" class="btn btn-default btn-lg">Reset</button>
				</form>
				<form
					id="explore-frequency"
					:class="['tab-pane form-horizontal', {'active': exploreMode==='frequency'}]"

					@submit.prevent.stop="submitFrequency"
					@reset.prevent.stop="resetFrequency"
				>
					<div class="form-group form-group-lg" style="margin: 0;">
						<label for="frequency-type" class="control-label">Frequency list type</label>
						<SelectPicker
								id="frequency-type"
								name="frequency-type"

								data-width="100%"

								:options="annotationOptions"

								v-model="frequencyType"
							/>
					</div>

					<!-- TODO don't duplicate here -->
					<hr>
					<div class="row">
						<Filters id="n-grams-filtercontainer" class="col-md-9"/>
					</div>
					<hr>
					<button type="submit" class="btn btn-primary btn-lg">Search</button>
					<button type="reset" class="btn btn-default btn-lg">Reset</button>
				</form>
			</div>
		</div>
	</div>
</template>

<script lang="ts">
import Vue from 'vue';

import * as RootStore from '@/store';
import * as CorpusStore from '@/store/corpus';
import * as InterfaceStore from '@/store/form/interface';
import * as FilterStore from '@/store/form/filters';
// import * as NGramStore from '@/store/form/ngrams';
// import * as FrequencyStore from '@/store/form/frequencies';
import * as ExploreStore from '@/store/form/explore';

import Filters from '@/pages/search/form/Filters.vue';
import SelectPicker, {Option} from '@/components/SelectPicker.vue';

import {makeWildcardRegex} from '@/utils';

export default Vue.extend({
	components: {
		Filters,
		SelectPicker
	},
	computed: {
		exploreMode: {
			get(): string { return InterfaceStore.getState().exploreMode; },
			set(v: 'frequency'|'ngram') { InterfaceStore.actions.exploreMode(v); }
		},

		annotationOptions(): Option[] {
			return CorpusStore.get.annotations()
			.filter(a => a.hasForwardIndex)
			.map ((annot): Option => ({
				label: annot.displayName,
				value: annot.id
			}));
		},
		defaultAnnotationId(): string { return CorpusStore.get.firstMainAnnotation().id; },

		ngramSize: {
			get(): number { return ExploreStore.get.ngram.size(); },
			set(v: number) { ExploreStore.actions.ngram.size(v); }
		},

		ngramType: {
			get(): string { return ExploreStore.get.ngram.groupAnnotationId(); },
			set(v: string) { return ExploreStore.actions.ngram.groupAnnotationId(v); }
		},

		ngramTokens(): ExploreStore.Token[] { return ExploreStore.get.ngram.tokens(); },
		ngramSizeMax(): number { return ExploreStore.get.ngram.maxSize(); },

		frequencyType: {
			get(): string { return ExploreStore.get.frequency.annotationId(); },
			set(v: string) { ExploreStore.actions.frequency.annotationId(v); }
		}

	},
	methods: {
		submitNgram() {
			// TODO this should live elsewhere probably.
			// const tokenStrings: string[] = [];
			// for (let i = 0; i < this.ngramSize; ++i) {
			// 	const {annotationId, value} = this.ngramTokens[i];
			// 	if (value) {
			// 		tokenStrings.push(`[${annotationId}="${makeWildcardRegex(value)}"]`);
			// 	} else {
			// 		tokenStrings.push('[]');
			// 	}
			// }

			// FormStore.actions.pattern.expert(tokenStrings.join(''));
			// FormStore.actions.activePattern('expert');
			// RootStore.actions.search();
			// Object.values(ResultsStore.modules).forEach(m => m.actions.reset());
			// ResultsStore.modules.hits.actions.groupBy([`hit:${this.ngramType}`]);

			RootStore.actions.searchFromSubmit();
		},
		resetNgram() {
			RootStore.actions.reset();

			// this.ngramTokens.forEach(t => {
			// 	t.annotationId = this.defaultAnnotationId;
			// 	t.value = '';
			// });
			// this.ngramSize = this.ngramSizeMax;
			// this.ngramType = this.defaultAnnotationId;
			// FilterStore.actions.reset();
		},
		submitFrequency() {
			// FormStore.actions.pattern.expert('[]');
			// FormStore.actions.activePattern('expert');
			// RootStore.actions.search();
			// Object.values(ResultsStore.modules).forEach(m => m.actions.reset());
			// ResultsStore.modules.hits.actions.groupBy([`hit:${this.frequencyType}`]);
			RootStore.actions.searchFromSubmit();
		},
		resetFrequency() {
			RootStore.actions.reset();
			// ExploreStore.actions.frequency.reset();
			// FilterStore.actions.reset();

			// this.frequencyType = this.defaultAnnotationId;
			// FormStore.actions.resetFilters();
		},

		updateTokenAnnotation(index: number, id: string) {
			ExploreStore.actions.ngram.token({
				index,
				token: { id }
			});
		},
		updateTokenValue(index: number, value: string) {
			ExploreStore.actions.ngram.token({
				index,
				token: { value }
			});
		}
	},
});
</script>

<style lang="scss">

.n-gram-container {
	display: flex;
	flex-direction: row;
	flex-wrap: nowrap;
}

.n-gram-token {
	flex-grow: 1;

	&+& {
		margin-left: 15px;
	}

	> .form-control {
		margin-top: 8px;
	}
}

</style>