<template>
	<div>
		<h3>Search for &hellip;</h3>
		<ul class="nav nav-tabs" id="searchTabs">
			<li class="active"><a href="#simple" data-toggle="tab" class="querytype">Simple</a></li>
			<li><a href="#extended" data-toggle="tab" class="querytype">Extended</a></li>
			<li><a href="#advanced" data-toggle="tab" class="querytype">Advanced</a></li>
			<li><a href="#expert" data-toggle="tab" class="querytype">Expert</a></li>
		</ul>
		<div class="tab-content">
			<div class="tab-pane active form-horizontal" id="simple">
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
			<div class="tab-pane form-horizontal" id="extended">
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
							<Annotation v-for="annotation in tab.annotations" :key="annotation.id" :annotation="annotation"/>
						</div>
					</div>
				</template>
				<template v-else>
					<Annotation v-for="(annotation, index) in allAnnotations" :key="index" :annotation="annotation"/> <!-- use index as annots can share ids -->
				</template>

				<div class="form-group">
					<!-- TODO extract available options from blacklab -->
					<label class="col-xs-12 col-md-3">Within:</label>

					<div class="btn-group col-xs-12 col-md-9" id="simplesearch_within">
						<button v-for="option in withinOptions"
							type="button"
							:class="['btn btn-default', {'active': within === option.value}]"
							:key="option.value"
							:value="option.value"
							@click="within = option.value"
						>{{option.label}}</button>
					</div>
				</div>
			</div>
			<div class="tab-pane" id="advanced">
				<div id="querybuilder"></div>
			</div>
			<div class="tab-pane" id="expert">
				<h3>Corpus Query Language:</h3>
				<textarea id="querybox" class="form-control" name="querybox" rows="7" v-model.lazy="expert"></textarea>
				<button type="button" class="btn btn-sm btn-default" name="parseQuery" id="parseQuery" title="Edit your query in the querybuilder">Copy to query builder</button>
				<span id="parseQueryError" class="text-danger" style="display:none;"><span class="fa fa-danger"></span> The querybuilder could not parse your query</span>
			</div>
		</div>
	</div>
</template>

<script lang="ts">
import Vue from 'vue';

import * as CorpusStore from '@/store/corpus';
import * as FormStore from '@/store/form';

import Annotation from '@/pages/search/form/Annotation.vue';

import * as AppTypes from '@/types/apptypes';

import uid from '@/mixins/uid';

export default Vue.extend({
	mixins: [uid],
	components: {
		Annotation,
	},
	computed: {
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
		firstMainAnnotation(): AppTypes.NormalizedAnnotation {
			return CorpusStore.get.firstMainAnnotation();
		},
		simple: {
			get(): string|null { return FormStore.getState().pattern.simple; },
			set(v: string) { FormStore.actions.pattern.simple(v); }
		},
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
			get(): string|null { return FormStore.getState().pattern.extended.within; },
			set(v: null|string) { FormStore.actions.pattern.extended.within(v); }
		},
		expert: {
			get(): string|null { return FormStore.getState().pattern.expert; },
			set(v: string) { FormStore.actions.pattern.expert(v); }
		}
	},
	methods: {
		getTabId(name: string) {
			return name.replace(/[^\w]/g, '_') + '_annotations';
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

/* simple search upload buttons */
.upload-button-container {
	position: relative;
}

.upload-button {
	position: absolute;
	overflow: hidden;
	right: 15px;
	top: 0px;
	border-top-left-radius: 0px;
	border-bottom-left-radius: 0px;
}

.upload-button input {
	position: absolute;
	left: 0;
	top: 0;
	height: 100%;
	width: 0px;
	padding-left: 100%;
	overflow: hidden;
	opacity: 0;
	background: transparent;
	z-index: 2;
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

</style>