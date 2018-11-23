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

			<div class="btn-group" style="display: flex; flex-wrap: none; flex: none;">
				<button type="button" class="btn btn-sm btn-primary" @click="submit" style="border-top-left-radius: 0; border-bottom-left-radius: 0;">Apply</button>
				<button type="button" class="btn btn-sm btn-default dropdown-toggle" data-toggle="dropdown"><span class="caret"/></button>
				<ul class="dropdown-menu">
					<li><a href="#" @click.prevent="undo">Undo</a></li>
				</ul>
			</div>

			<div v-if="unapplied.groupBy && unapplied.groupBy.length > 0" class="checkbox-inline" style="margin-left: 5px;">
				<label title="Separate groups for differently cased values" style="white-space: nowrap; margin: 0; cursor:pointer;" :for="uid+'case'"><input type="checkbox" :id="uid+'case'" v-model="unapplied.caseSensitive">Case sensitive</label>
			</div>
		</div>

		<div v-if="contextEnabled" class="groupby-context-container" >
			<ContextGroup v-for="(group, index) in unapplied.groupByAdvanced"
				:key="index"

				@delete="deleteContextGroup(index)"

				v-model="unapplied.groupByAdvanced[index]"
			/>
			<button v-if="contextSupported" type="button" class="btn btn-default btn-sm" @click="createContextGroup">New context group</button>
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

const CONTEXT_ENABLED_STRING = '_enable_context';

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
			// take care to not call mutating functions, as to not directly mutate state
			this.caseSensitive = this.unapplied.caseSensitive;
			this.groupBy = JSON.parse(JSON.stringify(this.contextEnabled ? this.unapplied.groupBy.filter(g => g !== CONTEXT_ENABLED_STRING) : this.unapplied.groupBy));
			this.groupByAdvanced = this.contextEnabled ? JSON.parse(JSON.stringify(this.unapplied.groupByAdvanced)) : [];
		},
		undo() {
			this.unapplied = JSON.parse(JSON.stringify(this.appliedSettings));
			this.contextEnabled = this.unapplied.groupByAdvanced.length > 0;
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
		normalGroupByOptions(): Array<OptGroup|Option> {
			const opts: Array<OptGroup|Option> = [];

			if (this.contextSupported) {
				opts.push({
					label: 'Context (advanced)',
					value: CONTEXT_ENABLED_STRING
				});
			}

			const metadataGroups = CorpusStore.get.metadataGroups();
			if (this.type === 'hits') {
				const annotations = CorpusStore.get.annotations().filter(a => !a.isInternal && a.hasForwardIndex);

				[['wordleft:', 'Before hit', 'before'],['hit:', 'Hit', ''],['wordright:', 'After hit', 'after']]
				.forEach(([prefix, groupname, suffix]) =>
					opts.push({
						label: groupname,
						options: annotations.map(annot => ({
							label: `Group by ${annot.displayName || annot.id} <small class="text-muted">${suffix}</small>`,
							value: `${prefix}${annot.id}`
						}))
					})
				);
			}
			metadataGroups.forEach(group => opts.push({
				label: group.name,
				options: group.fields.map(field => ({
					label: (field.displayName || field.id).replace(group.name, ''),
					value: `field:${field.id}`
				}))
			}))
			return opts;
		},

		contextSupported(): boolean { return this.type === 'hits'; },
		contextEnabled: {
			get(): boolean { return this.contextSupported && this.unapplied.groupBy.includes(CONTEXT_ENABLED_STRING); },
			set(v: boolean) {
				if (this.contextSupported && v !== this.contextEnabled) {
					if (v) {
						this.unapplied.groupBy.push(CONTEXT_ENABLED_STRING);
					} else {
						this.unapplied.groupBy = this.unapplied.groupBy.filter(g => g !== CONTEXT_ENABLED_STRING);
					}
				}
			}
		}
	},
	watch: {
		contextEnabled(v: boolean) {
			if (v && this.unapplied.groupByAdvanced.length === 0) {
				this.createContextGroup();
			}
		},
		appliedSettings: {
			immediate: true,
			handler() {
				this.undo();
			}
		}
	},
})
</script>

<style lang="scss">

.groupby-container {
	align-items: center;
	display: inline-flex;
	flex-wrap: nowrap;
	max-width: 100%;
	margin-bottom: 5px;

	> .groupselect {
		flex: 1 1 auto;
		min-width: 0px!important;
		width: auto!important;
		display: flex;
		flex-wrap: nowrap;

		> button {
			width: auto;
			max-width: 100%;
			padding-right: 26px; // for caret
			border-top-right-radius: 0px;
			border-bottom-right-radius: 0px;
			border-right-width: 0;
			display: flex;
			flex-wrap: nowrap;

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