<template>
	<div>
		<h3>Search for &hellip;</h3>
		<ul class="nav nav-tabs" id="searchTabs">
			<li :class="{'active': activePattern==='simple'}" @click.prevent="activePattern='simple'"><a href="#simple" class="querytype">Simple</a></li>
			<li :class="{'active': activePattern==='extended'}" @click.prevent="activePattern='extended'"><a href="#extended" class="querytype">Extended</a></li>
			<li :class="{'active': activePattern==='advanced'}" @click.prevent="activePattern='advanced'"><a href="#advanced" class="querytype">Advanced</a></li>
			<li :class="{'active': activePattern==='expert'}" @click.prevent="activePattern='expert'"><a href="#expert" class="querytype">Expert</a></li>
		</ul>
		<div class="tab-content">
			<div :class="['tab-pane form-horizontal', {'active': activePattern==='simple'}]" id="simple">
				<div class="form-group form-group-lg">
					<label class="control-label"
						:for="firstMainAnnotation.id + '_' + uid"
						:title="firstMainAnnotation.description || undefined"
					>{{firstMainAnnotation.	displayName}}
					</label>
					<input
						type="text"
						class="form-control"

						:id="firstMainAnnotation.id + '_' + uid"
						:name="firstMainAnnotation.id + '_' + uid"
						:placeholder="firstMainAnnotation.displayName"

						v-model="simple"
					/>
				</div>
			</div>
			<div :class="['tab-pane form-horizontal', {'active': activePattern==='extended'}]" id="extended">
				<template v-if="useTabs">
					<ul class="nav nav-tabs subtabs">
						<li v-for="(tab, index) in tabs" :class="{'active': index === 0}" :key="index">
							<a :href="'#'+getTabId(tab.name)" data-toggle="tab">{{tab.name}}</a>
						</li>
					</ul>
					<div class="tab-content">
						<div v-for="(tab, index) in tabs"
							:class="['tab-pane', {'active': index === 0}]"
							:key="index"
							:id="getTabId(tab.name)"
						>
							<Annotation v-for="annotation in tab.annotations" :key="annotation.annotatedFieldId + '/' + annotation.id" :annotation="annotation"/>
						</div>
					</div>
				</template>
				<template v-else>
					<Annotation v-for="annotation in allAnnotations" :key="annotation.annotatedFieldId + '/' + annotation.id" :annotation="annotation"/>
				</template>

				<div class="form-group">
					<!-- TODO extract available options from blacklab -->
					<label class="col-xs-12 col-md-3">Within:</label>

					<div class="btn-group col-xs-12 col-md-9">
						<button v-for="option in withinOptions"
							type="button"
							:class="['btn btn-default', {'active': within === option.value}]"
							:key="option.value"
							:value="option.value"
							@click="within = option.value"
						>{{option.label}}</button>
					</div>
				</div>
				<div class="form-group">
					<div class="col-xs-12 col-md-9 col-md-push-3 checkbox">
						<label for="extended_split_batch">
							<input type="checkbox" name="extended_split_batch" id="extended_split_batch" v-model="splitBatch"/> Split batch queries
						</label>
					</div>
				</div>
			</div>
			<div :class="['tab-pane', {'active': activePattern==='advanced'}]" id="advanced">
				<div id="querybuilder" ref="querybuilder"></div>
			</div>
			<div :class="['tab-pane', {'active': activePattern==='expert'}]" id="expert">
				<h3>Corpus Query Language:</h3>
				<textarea id="querybox" class="form-control" name="querybox" rows="7" v-model.lazy="expert"></textarea>
				<button type="button" class="btn btn-sm btn-default" name="parseQuery" id="parseQuery" title="Edit your query in the querybuilder" @click="parseQuery">Copy to query builder</button>
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
				<span v-show="parseQueryError" id="parseQueryError" class="text-danger"><span class="fa fa-danger"></span> {{parseQueryError}}</span>
				<span v-show="importQueryError" id="importQueryError" class="text-danger"><span class="fa fa-danger"></span> {{importQueryError}}</span>
			</div>
		</div>
	</div>
</template>

<script lang="ts">
import Vue from 'vue';

import * as RootStore from '@/store';
import * as CorpusStore from '@/store/corpus';
import * as InterfaceStore from '@/store/form/interface';
import * as PatternStore from '@/store/form/patterns';
import * as GapStore from '@/store/form/gap';
import * as HistoryStore from '@/store/history';

import Annotation from '@/pages/search/form/Annotation.vue';

import * as AppTypes from '@/types/apptypes';

import uid from '@/mixins/uid';

import {QueryBuilder} from '@/modules/cql_querybuilder';

export default Vue.extend({
	mixins: [uid],
	components: {
		Annotation,
	},
	data: () => ({
		parseQueryError: null as string|null,
		importQueryError: null as string|null,
	}),
	computed: {
		activePattern: {
			get(): string { return InterfaceStore.getState().patternMode; },
			set: InterfaceStore.actions.patternMode,
		},
		useTabs() {
			return this.tabs.length > 1;
		},
		tabs: CorpusStore.get.annotationGroups,
		allAnnotations(): AppTypes.NormalizedAnnotation[] {
			return this.tabs.reduce((acc, tab) => {
				acc.push(...tab.annotations);
				return acc;
			}, [] as AppTypes.NormalizedAnnotation[]);
		},
		firstMainAnnotation: CorpusStore.get.firstMainAnnotation,
		withinOptions(): Array<{label: string, value: string|null}> {
			// TODO retrieve from indexMetadata once available
			// discuss with jan?
			return [{
				label: 'document',
				value: null
			}, {
				label: 'paragraph',
				value: 'p'
			}, {
				label: 'sentence',
				value: 's'
			}]
		},
		within: {
			get(): string|null { return PatternStore.getState().extended.within; },
			set: PatternStore.actions.extended.within,
		},
		splitBatch: {
			get(): boolean { return PatternStore.getState().extended.splitBatch; },
			set: PatternStore.actions.extended.splitBatch
		},
		simple: {
			get(): string|null { return PatternStore.getState().simple; },
			set: PatternStore.actions.simple,
		},
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
	border: 1px solid #ccc
}

#simple > .form-group {
	margin: auto;
	max-width: 1170px;
}

// Some bootstrap tab customization
.nav-tabs.subtabs {
	border-bottom: none;
}

.nav-tabs.subtabs>li {
	margin-bottom: 0;
}

.nav-tabs.subtabs>li>a {
	border-radius: 0 0 4px 4px;
	padding: 4px 15px;
}

.nav-tabs.subtabs>li.active>a, .nav-tabs.subtabs>li>a:hover {
	border-color: transparent #ddd #ddd #ddd;
}

textarea.gap-value-editor {
	margin-top: 10px;
	height: 300px;
	max-width: 100%;
	resize: vertical;
	width: 100%;
}

</style>
