<template>
	<div>
		<h3>Search for &hellip;</h3>
		<ul class="nav nav-tabs" id="searchTabs">
			<li class="active"><a href="#simple" data-toggle="tab" class="querytype">Simple</a></li>
			<li><a href="#advanced" data-toggle="tab" class="querytype">Advanced</a></li>
			<li><a href="#query" data-toggle="tab" class="querytype">CQL query</a></li>
		</ul>
		<div class="tab-content">
			<div class="tab-pane active form-horizontal" id="simple" > <!-- #if ($usePropertyTabs) style="margin-top: -15px"#end -->
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

					<div class="btn-group col-xs-12 col-md-9" data-toggle="buttons" id="simplesearch_within" style="display:block;">
						<label class="btn btn-default active">
							<input type="radio" autocomplete="off" name="within" value="" checked="checked">document
						</label>
						<label class="btn btn-default">
							<input type="radio" autocomplete="off" name="within" value="p">paragraph
						</label>
						<label class="btn btn-default">
							<input type="radio" autocomplete="off" name="within" value="s">sentence
						</label>
					</div>
				</div>
			</div>
			<div class="tab-pane" id="advanced">
				<div id="querybuilder"></div>
			</div>
			<div class="tab-pane" id="query">
				<h3>Corpus Query Language:</h3>
				<textarea id="querybox" class="form-control" name="querybox" rows="7"></textarea>
				<button type="button" class="btn btn-sm btn-default" name="parseQuery" id="parseQuery" title="Edit your query in the querybuilder">Copy to query builder</button>
				<span id="parseQueryError" class="text-danger" style="display:none;"><span class="fa fa-danger"></span> The querybuilder could not parse your query</span>
			</div>
		</div>
	</div>
</template>

<script lang="ts">
import Vue from 'vue';

import * as corpus from '@/store/corpus';

import Annotation from '@/pages/search/form/Annotation.vue';

export default Vue.extend({
	components: {
		Annotation,
	},
	computed: {
		useTabs() {
			return this.tabs.length > 1;
		},
		tabs: corpus.get.annotationGroups,
		allAnnotations: corpus.get.annotations
	},
	methods: {
		getTabId(name: string) {
			return name.replace(/\s+/, '_') + '_annotations';
		}
	}
})
</script>

<style lang="scss">
</style>