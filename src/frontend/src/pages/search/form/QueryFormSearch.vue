<template>
	<div>
		<h3>Search for &hellip;</h3>
		<ul class="nav nav-tabs" id="searchTabs">
			<li :class="{'active': activePattern==='simple'}" @click.prevent="activePattern='simple'"><a href="#simple" class="querytype">Simple</a></li>
			<li :class="{'active': activePattern==='extended'}" @click.prevent="activePattern='extended'"><a href="#extended" class="querytype">Extended</a></li>
			<li :class="{'active': activePattern==='advanced'}" @click.prevent="activePattern='advanced'" v-if="advancedEnabled"><a href="#advanced" class="querytype">Advanced</a></li>
			<li :class="{'active': activePattern==='expert'}" @click.prevent="activePattern='expert'"><a href="#expert" class="querytype">Expert</a></li>
		</ul>
		<div class="tab-content">
			<div :class="['tab-pane form-horizontal', {'active': activePattern==='simple'}]" id="simple">
				<!-- TODO render the full annotation instance? requires some changes to bind to store correctly and apply appropriate classes though -->
				<div class="form-group form-group-lg">
					<label class="control-label"
						:for="firstMainAnnotation.id + '_' + uid"
						:title="firstMainAnnotation.description || undefined"
					>{{firstMainAnnotation.displayName}}
					</label>

					<Lexicon v-if="firstMainAnnotation.uiType === 'lexicon'"
						autofocus

						:annotationId="firstMainAnnotation.id"
						:definition="firstMainAnnotation"
						v-model="simple"

						ref="reset"
					/>
					<SelectPicker v-else-if="firstMainAnnotation.uiType === 'select'"
						data-width="100%"
						data-class="btn btn-lg btn-default"
						autofocus

						:searchable="firstMainAnnotation.values.length > 12"
						:placeholder="firstMainAnnotation.displayName"
						:data-id="firstMainAnnotation.id + '_' + uid"
						:data-name="firstMainAnnotation.id + '_' + uid"
						:data-dir="textDirection"

						:options="firstMainAnnotation.values"

						v-model="simple"
					/>
					<Autocomplete v-else
						type="text"
						class="form-control"
						autofocus

						useQuoteAsWordBoundary

						:id="firstMainAnnotation.id + '_' + uid"
						:placeholder="firstMainAnnotation.displayName"
						:dir="textDirection"

						:autocomplete="firstMainAnnotation.uiType === 'combobox'"
						:url="firstMainAnnotationACUrl"
						v-model="simple"
					/>
				</div>
			</div>
			<div :class="['tab-pane form-horizontal', {'active': activePattern==='extended'}]" id="extended">
				<template v-if="useTabs">
					<ul class="nav nav-tabs subtabs">
						<li v-for="(tab, index) in tabs" :class="{'active': index === 0}" :key="index">
							<a :href="'#'+getTabId(tab.label)" data-toggle="tab">{{tab.label}}</a>
						</li>
					</ul>
					<div class="tab-content">
						<div v-for="(tab, index) in tabs"
							:class="['tab-pane', 'annotation-container', {'active': index === 0}]"
							:key="index"
							:id="getTabId(tab.label)"
						>
							<Annotation v-for="annotation in tab.entries"
								:key="getTabId(tab.label) + '/' + annotation.annotatedFieldId + '/' + annotation.id"
								:htmlId="getTabId(tab.label) + '/' + annotation.annotatedFieldId + '/' + annotation.id"
								:annotation="annotation"
							/>
						</div>
					</div>
				</template>
				<template v-else>
					<Annotation v-for="annotation in allAnnotations"
						:key="annotation.annotatedFieldId + '/' + annotation.id"
						:htmlId="annotation.annotatedFieldId + '/' + annotation.id"
						:annotation="annotation"
					/>
				</template>

				<!-- show this even if it's disabled when "within" contains a value, or you can never remove the value -->
				<!-- this will probably never happen, but it could, if someone imports a query with a "within" clause active from somewhere -->
				<div v-if="withinOptions.length || within" class="form-group">
					<label class="col-xs-12 col-md-3">Within:</label>

					<div class="btn-group col-xs-12 col-md-9">
						<button v-for="option in withinOptions"
							type="button"
							:class="['btn', within === option.value ? 'active btn-primary' : 'btn-default']"
							:key="option.value"
							:value="option.value"
							:title="option.title || undefined"
							@click="within = option.value"
						>{{option.label || option.value || 'document'}}</button> <!-- empty value searches across entire documents -->
					</div>
				</div>
				<div v-if="splitBatchEnabled" class="form-group">
					<div class="col-xs-12 col-md-9 col-md-push-3 checkbox">
						<label for="extended_split_batch">
							<input type="checkbox" name="extended_split_batch" id="extended_split_batch" v-model="splitBatch"/> Split batch queries
						</label>
					</div>
				</div>
			</div>
			<div :class="['tab-pane', {'active': activePattern==='advanced'}]" id="advanced">
				<div id="querybuilder" ref="querybuilder"></div>
				<button type="button" class="btn btn-default btn-sm" @click="copyAdvancedQuery">Copy to CQL editor</button>
			</div>
			<div :class="['tab-pane', {'active': activePattern==='expert'}]" id="expert">
				<h3>Corpus Query Language:</h3>
				<textarea id="querybox" class="form-control" name="querybox" rows="7" v-model.lazy="expert"></textarea>
				<button v-if="advancedEnabled" type="button" class="btn btn-sm btn-default" name="parseQuery" id="parseQuery" title="Edit your query in the querybuilder" @click="parseQuery">Copy to query builder</button>
				<label class="btn btn-sm btn-default file-input-button" for="importQuery">
					Import query
					<input type="file" name="importQuery" id="importQuery" accept=".txt,text/plain" @change="importQuery" title="Import a previously downloaded query">
				</label>
				<div class="btn-group">
					<label class="btn btn-sm btn-default file-input-button" for="gapFilling">
						Gap-filling
						<input type="file" name="gapFilling" id="gapFilling" accept=".tsv,.csv,text/plain" @change="importGapFile" title="Upload a tab-separated list of values to substitute for gap values ('@@' in your query).">
					</label>
					<button v-if="gapValue != null"
						type="button"
						class="btn btn-default btn-sm"
						title="Clear gap values"
						@click="gapValue = null"
					><span class="fa fa-times"></span></button>
				</div>
				<textarea type="area" v-if="gapValue != null" class="form-control gap-value-editor" v-model.lazy="gapValue" @keydown.tab.prevent="insertTabInText"/>
				<span v-show="parseQueryError" id="parseQueryError" class="text-danger"><span class="fa fa-exclamation-triangle"></span> {{parseQueryError}}</span>
				<span v-show="importQueryError" id="importQueryError" class="text-danger"><span class="fa fa-exclamation-triangle"></span> {{importQueryError}}</span>
			</div>
		</div>
	</div>
</template>

<script lang="ts">
import Vue from 'vue';

import * as RootStore from '@/store/search/';
import * as CorpusStore from '@/store/search/corpus';
import * as UIStore from '@/store/search/ui';
import * as InterfaceStore from '@/store/search/form/interface';
import * as PatternStore from '@/store/search/form/patterns';
import * as GapStore from '@/store/search/form/gap';
import * as HistoryStore from '@/store/search/history';

import Annotation from '@/pages/search/form/Annotation.vue';
import Lexicon from '@/pages/search/form/Lexicon.vue';
import SelectPicker, { Option } from '@/components/SelectPicker.vue';
// @ts-ignore
import Autocomplete from '@/components/Autocomplete.vue';
import uid from '@/mixins/uid';

import { QueryBuilder } from '@/modules/cql_querybuilder';

import { paths } from '@/api';
import * as AppTypes from '@/types/apptypes';
import { getAnnotationSubset } from '@/utils';

export default Vue.extend({
	mixins: [uid],
	components: {
		Annotation,
		Autocomplete,
		SelectPicker,
		Lexicon
	},
	data: () => ({
		parseQueryError: null as string|null,
		importQueryError: null as string|null,

		subscriptions: [] as Array<() => void>
	}),
	computed: {
		activePattern: {
			get(): string { return InterfaceStore.getState().patternMode; },
			set: InterfaceStore.actions.patternMode,
		},
		useTabs(): boolean {
			return this.tabs.length > 1;
		},
		tabs(): Array<{label?: string, entries: AppTypes.NormalizedAnnotation[]}> {
			return getAnnotationSubset(
				UIStore.getState().search.extended.searchAnnotationIds,
				CorpusStore.getState().annotationGroups,
				CorpusStore.get.allAnnotationsMap(),
				'Search',
				CorpusStore.get.textDirection()
			);
		},
		allAnnotations(): AppTypes.NormalizedAnnotation[] {
			return this.tabs.flatMap(tab => tab.entries);
		},
		firstMainAnnotation: CorpusStore.get.firstMainAnnotation,
		firstMainAnnotationACUrl(): string { return paths.autocompleteAnnotation(CorpusStore.getState().id, this.firstMainAnnotation.annotatedFieldId, this.firstMainAnnotation.id); },
		textDirection: CorpusStore.get.textDirection,
		withinOptions(): Option[] {
			const {enabled, elements} = UIStore.getState().search.extended.within;
			return enabled ? elements : [];
		},
		within: {
			get(): string|null { return PatternStore.getState().extended.within; },
			set: PatternStore.actions.extended.within,
		},
		splitBatchEnabled(): boolean { return UIStore.getState().search.extended.splitBatch.enabled; },
		splitBatch: {
			get(): boolean { return PatternStore.getState().extended.splitBatch; },
			set: PatternStore.actions.extended.splitBatch
		},
		simple: {
			get(): string|null { return PatternStore.getState().simple; },
			set: PatternStore.actions.simple,
		},
		advancedEnabled(): boolean { return UIStore.getState().search.advanced.enabled; },
		advanced: {
			get(): string|null { return PatternStore.getState().advanced; },
			set: PatternStore.actions.advanced,
		},
		expert: {
			get(): string|null { return PatternStore.getState().expert; },
			set: PatternStore.actions.expert,
		},
		gapValue: {
			get: GapStore.get.gapValue,
			set: GapStore.actions.gapValue
		}
	},
	methods: {
		getTabId(name: string) {
			return name.replace(/[^\w]/g, '_') + '_annotations';
		},
		parseQuery() {
			// TODO dedicated component - port builder?
			const builder: QueryBuilder = $(this.$refs.querybuilder).data('builder');
			if (builder && builder.parse(this.expert)) {
				InterfaceStore.actions.patternMode('advanced');
				this.parseQueryError = null;
			} else {
				this.parseQueryError = 'The querybuilder could not parse your query.';
			}
		},
		importQuery(event: Event) {
			const el = (event.target as HTMLInputElement);
			if (!el.files || el.files.length !== 1) {
				return;
			}

			const file = el.files[0];
			HistoryStore.get.fromFile(file)
			.then(r => {
				RootStore.actions.replace(r.entry);
				this.importQueryError = null;
			})
			.catch(e => this.importQueryError = e.message)
			.finally(() => el.value = '')
		},
		importGapFile(event: Event) {
			const self = this;
			const el = (event.target as HTMLInputElement);
			if (!el.files || el.files.length !== 1) {
				self.gapValue = null;
				return;
			}
			GapStore.actions.gapValueFile(el.files[0]);
			el.value = '';
		},
		insertTabInText(event: Event) {
			const el = event.target as HTMLTextAreaElement;
			let text = el.value;

			const originalSelectionStart = el.selectionStart;
			const originalSelectionEnd = el.selectionEnd;
			const textStart = text.slice(0, originalSelectionStart);
			const textEnd =  text.slice(originalSelectionEnd);

			el.value = `${textStart}\t${textEnd}`;
			el.selectionEnd = el.selectionStart = originalSelectionStart + 1;
		},

		copyAdvancedQuery() {
			PatternStore.actions.expert(PatternStore.getState().advanced);
			InterfaceStore.actions.patternMode('expert');
		}
	},
	mounted() {
		if (this.$refs.reset) {
			const eventId = `${PatternStore.namespace}/reset`;

			this.subscriptions.push(RootStore.store.subscribe((mutation, state) => {
				if (this.$refs.reset && mutation.type === eventId) {
					(this.$refs.reset as any).reset();
				}
			}));
		}
	}
})
</script>

<style lang="scss">
.subtabs {
	margin-top: -15px;
}

#querybox {
	width: 100%;
	resize: none;
	margin-bottom: 10px;
}

#querybuilder {
	background-color: rgba(255, 255, 255, 0.7);
	border-radius: 4px;
	box-shadow: inset 0 1px 1px rgba(0, 0, 0, .075);
	border: 1px solid #ccc;
	margin-bottom: 10px;
}

#simple > .form-group {
	margin: auto;
	max-width: 1170px;
}

// Some bootstrap tab customization
.nav-tabs.subtabs {
	border-bottom: none;

	>li {
		margin-bottom: 0;

		> a {
			border-radius: 0 0 4px 4px;
			padding: 4px 15px;
		}

		&.active > a,
		> a:hover {
			border-color: transparent #ddd #ddd #ddd;
		}
	}
}

textarea.gap-value-editor {
	margin-top: 10px;
	height: 300px;
	max-width: 100%;
	resize: vertical;
	width: 100%;
}

.annotation-container {
	max-height: 385px; // 5 fields @ 74px + 15px padding
	overflow: auto;
	overflow-x: hidden;
	margin-bottom: 15px;
}

</style>
