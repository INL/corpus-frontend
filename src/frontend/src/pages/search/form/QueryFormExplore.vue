<template>
	<div>
		<h3>Explore ...</h3>
		<ul class="nav nav-tabs">
			<li :class="{'active': exploreMode==='corpora'}"   @click.prevent="exploreMode='corpora'"><a href="#explore-corpora">Corpora</a></li>
			<li :class="{'active': exploreMode==='ngram'}"     @click.prevent="exploreMode='ngram'"><a href="#explore-n-grams">N-grams</a></li>
			<li :class="{'active': exploreMode==='frequency'}" @click.prevent="exploreMode='frequency'"><a href="#explore-frequency">Statistics</a></li>
		</ul>

		<div class="tab-content">
			<div id="explore-corpora" :class="['tab-pane form-horizontal', {'active': exploreMode==='corpora'}]">
				<div class="form-group">
					<label class="col-xs-4 col-md-2" for="corpora-group-by">Group documents by metadata</label>
					<div class="col-xs-8">
						<SelectPicker
							placeholder="Group by..."
							data-id="corpora-group-by"
							data-width="100%"
							style="max-width: 400px;"

							searchable
							hideEmpty
							allowHtml

							:options="corporaGroupByOptions"
							v-model="corporaGroupBy"
						/>
					</div>
				</div>
				<div class="form-group">
					<label class="col-xs-4 col-md-2" for="corpora-display-mode">Show groups as</label>
					<div class="col-xs-8">
						<SelectPicker
							placeholder="Show as"
							data-id="corpora-display-mode"
							data-width="100%"
							style="max-width: 400px;"

							hideEmpty
							allowHtml

							:options="corporaGroupDisplayModeOptions"
							v-model="corporaGroupDisplayMode"
						/>
					</div>
				</div>
			</div>
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
							data-name="n-gram-type"
							data-id="n-gram-type"

							data-width="100%"
							hideEmpty

							:options="ngramAnnotationOptions"

							v-model="ngramType"
						/>
					</div>
				</div>

				<div class="n-gram-container">
					<div v-for="(token, index) in ngramTokens" :key="index" class="n-gram-token">
						<SelectPicker
							data-width="100%"

							:options="ngramAnnotationOptions"
							:disabled="index >= ngramSize"
							:value="token.id"
							placeholder="Property"
							hideEmpty

							@change="updateTokenAnnotation(index, $event /* custom component - custom event values */)"
						/>
						<input v-if="!token.annotation" type="text" disabled title="Please select an annotation to edit." class="form-control" :value="token.value">
						<SelectPicker v-else-if="token.annotation.uiType === 'select' || (token.annotation.uiType === 'pos' && token.annotation.values)"
							data-width="100%"
							data-class="btn btn-default"

							:searchable="token.annotation.values.length > 12"
							:placeholder="token.annotation.displayName"
							:data-dir="token.annotation.isMainAnnotation ? mainTokenTextDirection : undefined"
							:options="token.annotation.values"
							:disabled="index >= ngramSize"

							:value="token.value"
							@change="updateTokenValue(index, $event)"
						/>

						<Autocomplete v-else
							type="text"
							class="form-control"

							:placeholder="token.annotation.displayName"
							:dir="token.annotation.isMainAnnotation ? mainTokenTextDirection : undefined"
							:disabled="index >= ngramSize"

							:autocomplete="token.annotation.uiType === 'combobox'"
							:url="autocompleteUrl(token.annotation)"

							:value="token.value"
							@change="updateTokenValue(index, $event)"
						/>
					</div>
				</div>
			</div>
			<div id="explore-frequency" :class="['tab-pane form-horizontal', {'active': exploreMode==='frequency'}]">
				<div class="form-group form-group-lg" style="margin: 0;">
					<label for="frequency-type" class="control-label">Frequency list type</label>
					<SelectPicker
						data-id="frequency-type"
						data-name="frequency-type"

						data-width="100%"
						hideEmpty

						:options="frequencyAnnotationOptions"

						v-model="frequencyType"
					/>
				</div>
			</div>
		</div>
	</div>
</template>

<script lang="ts">
import Vue from 'vue';

import * as CorpusStore from '@/store/search/corpus';
import * as InterfaceStore from '@/store/search/form/interface';
import * as ExploreStore from '@/store/search/form/explore';
import * as UIStore from '@/store/search/ui';

import SelectPicker, {Option, OptGroup} from '@/components/SelectPicker.vue';
import Autocomplete from '@/components/Autocomplete.vue';
import { selectPickerMetadataOptions } from '@/utils';
import { paths } from '@/api';

export default Vue.extend({
	components: {
		SelectPicker,
		Autocomplete
	},
	computed: {
		exploreMode: {
			get(): string { return InterfaceStore.getState().exploreMode; },
			set: InterfaceStore.actions.exploreMode,
		},

		ngramSize: {
			get: ExploreStore.get.ngram.size,
			set: ExploreStore.actions.ngram.size,
		},

		ngramType: {
			get: ExploreStore.get.ngram.groupAnnotationId,
			set: ExploreStore.actions.ngram.groupAnnotationId,
		},

		ngramTokens() {
			const allAnnotations = CorpusStore.get.allAnnotationsMap();
			return ExploreStore.get.ngram.tokens().map(tok => ({
				...tok,
				annotation: allAnnotations[tok.id] ? allAnnotations[tok.id][0] : null
			}));
		},
		ngramSizeMax: ExploreStore.get.ngram.maxSize,

		frequencyType: {
			get: ExploreStore.get.frequency.annotationId,
			set: ExploreStore.actions.frequency.annotationId,
		},

		corporaGroupBy: {
			get: ExploreStore.get.corpora.groupBy,
			set: ExploreStore.actions.corpora.groupBy,
		},
		corporaGroupDisplayMode: {
			get: ExploreStore.get.corpora.groupDisplayMode,
			set: ExploreStore.actions.corpora.groupDisplayMode,
		},

		ngramAnnotationOptions(): Option[] {
			const annotations = CorpusStore.get.annotationDisplayNames();
			return UIStore.getState().explore.shownAnnotationIds.map(id => ({
				value: id,
				label: annotations[id]
			}));
		},

		corporaGroupByOptions(): OptGroup[] {
			const metas = CorpusStore.get.allMetadataFieldsMap();
			const groups = CorpusStore.getState().metadataFieldGroups;
			const shownMetaIds = UIStore.getState().explore.shownMetadataFieldIds;
			return selectPickerMetadataOptions(shownMetaIds, metas, groups, 'Group');
		},
		corporaGroupDisplayModeOptions(): string[] {
			// TODO
			return ['table', 'docs', 'tokens'];
		},

		frequencyAnnotationOptions(): Option[] { return this.ngramAnnotationOptions; },

		mainTokenTextDirection: CorpusStore.get.textDirection,

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
		},
		autocompleteUrl(annot: CorpusStore.NormalizedAnnotation) {
			return paths.autocompleteAnnotation(CorpusStore.getState().id, annot.annotatedFieldId, annot.id);
		}
	},
	created() {
		this.corporaGroupDisplayMode = this.corporaGroupDisplayModeOptions[0];
	}
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

	> .form-control,
	> .combobox {
		margin-top: 8px;
	}
}

</style>