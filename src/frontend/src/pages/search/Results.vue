<template>
	<div>
		<div class="resultcontrols">
			<div class="top">
				<div class="grouping">
					<div class="groupselect-container">
						<select class="selectpicker groupselect" title="Group hits by..." data-size="15" data-actions-box="true" data-deselect-all-text="reset" data-show-subtext="true" data-style="btn-default btn-sm" multiple>
							<optgroup v-if="isHits" v-for="g in [
									{id: 'wordleft', displayName: 'Before hit'},
									{id: 'hit', displayName: 'Hit'},
									{id: 'wordright', displayName: 'After hit'}
								]"
								:key="g.id"
								:label="g.displayName"
							>
								<option v-for="annot in annotations"
									:key="annot.id"
									:value="`${g.id}:${annot.id}`"
									:data-content='`Group by ${annot.displayName} <small class="text-muted">before</small>`'
								/>
							</optgroup>
							<optgroup v-for="g in metadataGroups"
								:key="g.name"
								:label="g.name"
							>
								<option v-for="field in g.fields"
									:key="field.fieldName"
									:value="`field:${field.fieldName}`"
								>Group by {{field.displayName}}</option>
							</optgroup>
						</select>
						<button type="button" class="btn btn-sm btn-default dummybutton">update</button> <!-- dummy button... https://github.com/INL/corpus-frontend/issues/88 -->
						<div class="checkbox-inline" style="margin-left: 5px;">
							<label title="Separate groups for differently cased values" style="white-space: nowrap; margin: 0;" for="casesensitive-groups-hits"><input type="checkbox" class="casesensitive" id="casesensitive-groups-hits" name="casesensitive-groups-hits">Case sensitive</label>
						</div>
					</div>

					<div class="resultgroupdetails btn btn-sm btn-default nohover" style="margin-right: 5px">
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

import {modules} from '@/store';
import {BLAnnotation} from '@/types/blacklabtypes';

export default Vue.extend({
	props: {
		// TODO this can probably be calculated based on the displayed results?
		isHits: Boolean as () => boolean,
	},
	data: () => ({
		annotations: modules.index.get.annotatedFields(),
		metadataGroups: modules.index.get.metadataGroups()
	}),
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
			}
		}

		>.buttons {
			flex: 0 1000 auto;
		}
	}
}

</style>