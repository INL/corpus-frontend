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
						<input
							class="form-control"
							type="text"

							:disabled="index >= ngramSize"
							:value="token.value"
							:dir="token.annotation.isMainAnnotation ? mainTokenTextDirection : undefined"

							@change="updateTokenValue(index, $event.target.value /* native component - native event */)"
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

export default Vue.extend({
	components: {
		SelectPicker
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
			return ExploreStore.get.ngram.tokens().map(tok => ({
				...tok,
				annotation: CorpusStore.get.allAnnotationsMap()[tok.id][0]
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
			const metadataFields = CorpusStore.getState().metadataFields;
			const fieldsPerGroup = UIStore.getState().explore.shownMetadataFieldIds.reduce<{[groupId: string]: Option[]}>((groups, fieldId) => {
				const field = metadataFields[fieldId];
				// default fallback group, may happen if corpus wants to show options for grouping on certain metadata fields
				// that are not available for regular subcorpus selection (i.e. not in a metadataFieldGroup, which normally hides the field in the ui)
				const groupId = field.groupId || 'Metadata';
				const fieldsInGroup = groups[groupId] = groups[groupId] || [];
				fieldsInGroup.push({
					label: `Group by ${(field.displayName || field.id).replace(groupId, '')} <small class="text-muted">(${groupId})</small>`,
					value: `field:${field.id}`
				});

				return groups;
			}, {});

			return Object.entries(fieldsPerGroup)
			.map(([groupName, options]): OptGroup => ({
				label: groupName,
				options
			}));
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
		}
	},
	created() {
		this.corporaGroupBy = `field:${UIStore.getState().explore.defaultMetadataFieldId}`;
		this.ngramType = UIStore.getState().explore.defaultAnnotationId;
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

	> .form-control {
		margin-top: 8px;
	}
}

</style>