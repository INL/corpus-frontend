<template>
	<div>
		<div class="groupby-container">
			<SelectPicker
				multiple
				class="groupselect"
				data-size="15"
				data-actions-box="true"
				data-deselect-all-text="reset"
				data-show-subtext="true"
				data-style="btn-default btn-sm"
				data-live-search="true"

				:options="normalGroupByOptions"
				:escapeLabels="false"
				:title="`Group ${type} by...`"

				v-model="unapplied.groupBy"
			/>

			<div v-if="unapplied.groupBy && unapplied.groupBy.length > 0" class="checkbox-inline" style="margin-left: 5px;">
				<label title="Separate groups for differently cased values" style="white-space: nowrap; margin: 0; cursor:pointer;" :for="uid+'case'"><input type="checkbox" :id="uid+'case'" v-model="unapplied.caseSensitive">Case sensitive</label>
			</div>
		</div>

		<div v-if="contextSupported" class="groupby-context-container" >
			<ContextGroup v-for="(group, index) in unapplied.groupByAdvanced"
				:key="index"

				@delete="deleteContextGroup(index)"

				v-model="unapplied.groupByAdvanced[index]"
			/>
		</div>

		<div class="groupby-buttons-container">
			<button v-if="contextSupported" type="button" class="btn btn-default btn-sm" @click="createContextGroup">Group by context</button>
			<button type="button" class="btn btn-primary btn-sm" @click="submit">Apply</button>
		</div>
	</div>
</template>

<script lang="ts">
import Vue from 'vue';

import * as CorpusStore from '@/store/corpus';
import * as ResultsStore from '@/store/results';

import SelectPicker, {OptGroup, Option} from '@/components/SelectPicker.vue';
import ContextGroup from '@/pages/search/results/groupby/ContextGroup.vue';
import UID from '@/mixins/uid';

export default Vue.extend({
	mixins: [UID],
	components: {
		SelectPicker,
		ContextGroup,
	},
	props: {
		type: String as () => ResultsStore.ViewId
	},
	data: () => ({
		unapplied: {
			groupBy: [] as string[],
			groupByAdvanced: [] as string[],
			caseSensitive: false,
		}
	}),
	methods: {
		submit() {
			// take care not to alias...
			this.caseSensitive = this.unapplied.caseSensitive;
			this.groupBy.splice(0, this.groupBy.length, ...this.unapplied.groupBy);
			this.groupByAdvanced.splice(0, this.groupByAdvanced.length, ...this.unapplied.groupByAdvanced);
		},
		undo() {
			// DON'T alias these objects...
			this.unapplied = JSON.parse(JSON.stringify(this.appliedSettings));
		},

		createContextGroup() { this.unapplied.groupByAdvanced.push(''); },
		deleteContextGroup(index: number) { this.unapplied.groupByAdvanced.splice(index, 1); },
	},
	computed: {
		storeModule() { return ResultsStore.modules[this.type]; },
		caseSensitive: {
			get(): boolean { return this.storeModule.getState().caseSensitive },
			set(v: boolean) { this.storeModule.actions.caseSensitive(v); }
		},
		groupBy: {
			get(): string[] { return this.storeModule.getState().groupBy; },
			set(v: string[]) { this.storeModule.actions.groupBy(v); }
		},
		groupByAdvanced: {
			get(): string[] { return this.storeModule.getState().groupByAdvanced; },
			set(v: string[]) { this.storeModule.actions.groupByAdvanced(v); }
		},
		// useful shorthand for all props from store
		appliedSettings() {
			return {
				caseSensitive: this.caseSensitive,
				groupBy: this.groupBy,
				groupByAdvanced: this.groupByAdvanced
			}
		},

		// Calculated fields
		normalGroupByOptions(): OptGroup[] {
			const groups: OptGroup[] = [];

			const metadataGroups = CorpusStore.get.metadataGroups();
			if (this.type === 'hits') {
				const annotations = CorpusStore.get.annotations();

				[['wordleft:', 'Before hit', 'before'],['hit:', 'Hit', ''],['wordright:', 'After hit', 'after']]
				.forEach(([prefix, groupname, suffix]) =>
					groups.push({
						label: groupname,
						options: annotations.map(annot => ({
							label: `Group by ${annot.displayName || annot.id} <small class="text-muted">${suffix}</small>`,
							value: `${prefix}${annot.id}`
						}))
					})
				);
			}
			metadataGroups.forEach(group => groups.push({
				label: group.name,
				options: group.fields.map(field => ({
					label: (field.displayName || field.id).replace(group.name, ''),
					value: `field:${field.id}`
				}))
			}))
			return groups;
		},

		contextSupported(): boolean { return this.type === 'hits'; }
	},
	watch: {
		appliedSettings: {
			deep: true,
			immediate: true,
			handler(v) {
				// sync with store on changes from store
				this.undo();
			}
		}
	}
})
</script>

<style lang="scss">

.groupby-container {
	align-items: center;
	display: inline-flex;
	flex-wrap: nowrap;
	margin-bottom: 5px;
	margin-right: 5px;
	max-width: 100%;

	> .groupselect {
		flex: 1 1 auto;
		min-width: 0px!important;
		width: auto!important;

		> button {
			width: auto;
			max-width: 100%;
			padding-right: 26px; // for caret

			> .filter-option {
				padding: 0;
				height: auto;
				max-width: none;
				position: static;
				top: auto;
				left: auto;
				width: 100%;
				display: inline-block;

				> .filter-option-inner {
					display: inline-block;
					width: 100%;

					> .filter-option-inner-inner {
						display: inline-block;
						width: 100%;
						overflow: hidden;
						text-overflow: ellipsis;
						vertical-align: top;
					}
				}
			}

			&:before {
				display: none;
			}
		}
	}
}

.groupby-buttons-container {
	display: flex;
	justify-content: space-between;
	margin-top: 5px;
}

</style>