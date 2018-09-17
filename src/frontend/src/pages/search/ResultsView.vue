<template>
	<div>
		<div class="resultcontrols">
			<div class="top">
				<div class="grouping">
					<div class="groupselect-container">
						<select class="selectpicker groupselect" title="Group hits by..." data-size="15" data-actions-box="true" data-deselect-all-text="reset" data-show-subtext="true" data-style="btn-default btn-sm" multiple ref="groupselect">
							<optgroup v-for="(group, index) in optGroups" :key="index" :label="group.label">
								<option v-for="option in group.options" :key="option.value" :value="option.value" :data-content="option.label"/>
							</optgroup>
						</select>
						<button type="button" class="btn btn-sm btn-default dummybutton">update</button> <!-- dummy button... https://github.com/INL/corpus-frontend/issues/88 -->
						<div class="checkbox-inline" style="margin-left: 5px;">
							<label title="Separate groups for differently cased values" style="white-space: nowrap; margin: 0;" for="casesensitive-groups-hits"><input type="checkbox" class="casesensitive" id="casesensitive-groups-hits" name="casesensitive-groups-hits">Case sensitive</label>
						</div>
					</div>

					<div v-if="settings.viewgroup" class="resultgroupdetails btn btn-sm btn-default nohover" style="margin-right: 5px">
						<span class="fa fa-exclamation-triangle text-danger"></span> Viewing group <span class="resultgroupname"></span> &mdash; <a class="clearviewgroup" href="javascript:void(0)">Go back</a>
					</div>

					<div class="results-incomplete-warning btn btn-sm btn-default nohover">
						<span class="fa fa-exclamation-triangle text-danger"></span> Too many results! &mdash; your query was limited
					</div>
				</div>

				<div class="buttons">
					<button type="button" class="btn btn-default btn-sm pull-right exportcsv" style="margin-left: 5px;margin-bottom: 5px;">Export CSV</button>
					<button type="button" class="btn btn-danger btn-sm pull-right" data-toggle="collapse" data-target=".doctitle" style="margin-left: 5px;margin-bottom: 5px;">Show/hide titles</button>
				</div>
			</div>

			<ul class="pagination pagination-sm"></ul>
		</div>

		<span class="fa fa-spinner fa-spin searchIndicator" style="position:absolute; left: 50%; top:15px"></span>

		<div class="lightbg haspadding resultcontainer">
			<table class="resultstable">
				<tbody>
				</tbody>
			</table>
		</div>
	</div>

</template>

<script lang="ts">
import Vue from "vue";

import * as resultsStore from '@/store/results';
import * as corpus from '@/store/corpus';
import {BLAnnotation} from '@/types/blacklabtypes';

type OptGroup = {
	label: string;
	options: Array<{
		label: string;
		value: string;
	}>;
}

export default Vue.extend({
	props: {
		type: String as () => 'hits'|'docs',
	},
	computed: {
		optGroups(): OptGroup[] {
			const groups: OptGroup[] = [];

			const metadataGroups = corpus.get.metadataGroups();
			if (this.type === 'hits') {
				const annotations = corpus.get.annotatedFields();

				[['wordleft:', 'Before hit'],['word:', 'Hit'],['wordRight:', 'After hit']]
				.forEach(([prefix, label]) =>
					groups.push({
						label,
						options: annotations.map(annot => ({
							label: `Group by ${annot.displayName} <small class="text-muted">${label.split(' ')[0].toLowerCase()}</small>`,
							value: `${prefix}${annot.id}`
						}))
					})
				);
			}
			metadataGroups.forEach(group => groups.push({
				label: group.name,
				options: group.fields.map(field => ({
					label: (field.displayName || field.fieldName).replace(group.name, ''),
					value: field.fieldName
				}))
			}))
			return groups;
		},
		settings() { return resultsStore[this.type] }
	},
	watch: {

	}
	// mounted() {
	// 	$(this.$refs.groupselect).selectpicker();
	// }
});
</script>

<style lang="scss">

.resultcontrols {
	>.top {
		align-items: flex-start;
		display: flex;
		justify-content: space-between;

		>.grouping {
			display: flex;
			flex-wrap: wrap;
			min-width: 220px;
			max-width: 100%;

			>.groupselect-container {
				align-items:center;
				display:flex;
				flex-wrap:nowrap;

				li a {
					text-transform: capitalize;
				}
			}
		}

		>.buttons {
			flex: 0 1000 auto;
		}
	}
}

</style>