<template>
	<div>
		<h3>Explore ...</h3>
		<ul class="nav nav-tabs">
			<li :class="{'active': exploreMode==='ngram'}"     @click.prevent="exploreMode='ngram'"><a href="#explore-n-grams">N-grams</a></li>
			<li :class="{'active': exploreMode==='frequency'}" @click.prevent="exploreMode='frequency'"><a href="#explore-frequency">Statistics</a></li>
		</ul>

		<div class="tab-content">
			<div id="explore-n-grams" :class="['tab-pane form-horizontal', {'active': exploreMode==='ngram'}]">
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
							hideEmpty

							:options="annotationOptions"

							v-model="ngramType"
						/>
					</div>
				</div>

				<div class="n-gram-container">
					<div v-for="(token, index) in ngramTokens" :key="index" class="n-gram-token">
						<SelectPicker
							data-width="100%"

							:options="annotationOptions"
							:disabled="index >= ngramSize"
							:value="token.id"
							placeholder="Property"
							hideEmpty

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
			</div>
			<div id="explore-frequency" :class="['tab-pane form-horizontal', {'active': exploreMode==='frequency'}]">
				<div class="form-group form-group-lg" style="margin: 0;">
					<label for="frequency-type" class="control-label">Frequency list type</label>
					<SelectPicker
						id="frequency-type"
						name="frequency-type"

						data-width="100%"
						hideEmpty

						:options="annotationOptions"

						v-model="frequencyType"
					/>
				</div>
			</div>
		</div>
	</div>
</template>

<script lang="ts">
import Vue from 'vue';

import * as RootStore from '@/store';
// import * as CorpusStore from '@/store/corpus';
import * as InterfaceStore from '@/store/form/interface';
import * as ExploreStore from '@/store/form/explore';
import * as UIStore from '@/store/ui';

import SelectPicker, {Option} from '@/components/SelectPicker.vue';

export default Vue.extend({
	components: {
		SelectPicker
	},
	computed: {
		exploreMode: {
			get(): string { return InterfaceStore.getState().exploreMode; },
			set: InterfaceStore.actions.exploreMode,
		},

		annotationOptions() { return UIStore.getState().explore.shownAnnotations; },
		defaultAnnotationId() { return UIStore.getState().explore.defaultAnnotation; },
		// annotationOptions(): Option[] {
		// 	return CorpusStore.get.annotations()
		// 	.filter(a => a.hasForwardIndex)
		// 	.map ((annot): Option => ({
		// 		label: annot.displayName,
		// 		value: annot.id
		// 	}));
		// },
		// defaultAnnotationId(): string { return CorpusStore.get.firstMainAnnotation().id; },

		ngramSize: {
			get: ExploreStore.get.ngram.size,
			set: ExploreStore.actions.ngram.size,
		},

		ngramType: {
			get: ExploreStore.get.ngram.groupAnnotationId,
			set: ExploreStore.actions.ngram.groupAnnotationId,
		},

		ngramTokens: ExploreStore.get.ngram.tokens,
		ngramSizeMax: ExploreStore.get.ngram.maxSize,

		frequencyType: {
			get: ExploreStore.get.frequency.annotationId,
			set: ExploreStore.actions.frequency.annotationId,
		}

	},
	methods: {
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
	width: 0;

	&+& {
		margin-left: 15px;
	}

	> .form-control {
		margin-top: 8px;
	}
}

</style>