<template>
	<div>
		<div class="groupby-container">
			<SelectPicker
				class="groupselect"

				allowHtml
				allowUnknownValues
				data-class="btn-sm btn-default"
				data-width="275px"
				:data-style="{
					borderTopRightRadius: contextEnabled ? 0 : undefined,
					borderBottomRightRadius: contextEnabled ? 0 : undefined,
					borderRightWidth: contextEnabled ? 0 : undefined,
				}"
				:placeholder="`Group ${type} by...`"
				:searchable="normalGroupByOptions.flatMap(o => o.options ? o.options : o).length > 15"
				:disabled="disabled"
				:options="normalGroupByOptions"

				v-model="groupBy"
			/>
			<button v-if="contextEnabled"
				type="button"
				class="btn btn-sm btn-primary"
				style="border-top-left-radius: 0; border-bottom-left-radius: 0;"
				:disabled="disabled"
				@click="submitContext"
			>Apply</button>

			<div v-if="groupBy && !contextEnabled" :class="['checkbox-inline', {'disabled': disabled}]" style="margin-left: 5px;">
				<label title="Separate groups for differently cased values" style="white-space: nowrap; margin: 0; cursor:pointer;" :for="uid+'case'">
					<input type="checkbox" :id="uid+'case'" :disabled="disabled" v-model="caseSensitive">Case sensitive
				</label>
			</div>
		</div>

		<div v-if="viewGroup" style="color: #888; font-size: 85%;">
			<button type="button" class="btn btn-sm btn-primary" :disabled="disabled" @click="viewGroup = null"><span class="fa fa-angle-double-right"></span> Go back to grouped view</button>
		</div>

		<div v-if="contextEnabled" class="groupby-context-container" >
			<ContextGroup v-for="(group, index) in unappliedContextGroups"
				:key="index"

				@delete="deleteContextGroup(index)"

				v-model="unappliedContextGroups[index]"
			/>
			<button v-if="contextSupported" type="button" class="btn btn-default btn-sm" @click="createContextGroup">New context group</button>
		</div>
	</div>
</template>

<script lang="ts">
import Vue from 'vue';

import * as CorpusStore from '@/store/search/corpus';
import * as ResultsStore from '@/store/search/results';
import * as UIStore from '@/store/search/ui';

import SelectPicker, {OptGroup, Option} from '@/components/SelectPicker.vue';
import ContextGroup from '@/pages/search/results/groupby/ContextGroup.vue';
import UID from '@/mixins/uid';
import { mapReduce, MapOf } from '../../../../utils';

const CONTEXT_ENABLED_STRING = '_enable_context';

export default Vue.extend({
	mixins: [UID],
	components: {
		SelectPicker,
		ContextGroup,
	},
	props: {
		type: String as () => ResultsStore.ViewId,
		viewGroupName: String as () => null|string,
		disabled: Boolean
	},
	data: () => ({
		contextEnabled: false,
		unappliedContextGroups: [] as string[],
	}),
	methods: {
		submitContext() {
			this.storeModule.actions.groupByAdvanced(this.unappliedContextGroups);
			if (this.storeModule.getState().groupBy.length) {
				this.storeModule.actions.groupBy([]);
			}
		},
		undoContext() {
			this.unappliedContextGroups = this.appliedContextGroups.concat(); // prevent aliasing
			if (this.unappliedContextGroups.length === 0) {
				this.createContextGroup();
			}
		},

		createContextGroup() { this.unappliedContextGroups.push(''); },
		deleteContextGroup(index: number) { this.unappliedContextGroups.splice(index, 1); },
	},
	computed: {
		storeModule() {
			return ResultsStore.get.resultsModules().find(m => m.namespace === this.type)!;
		},
		caseSensitive: {
			get(): boolean { return this.storeModule.getState().caseSensitive; },
			set(v: boolean) { this.storeModule.actions.caseSensitive(v); }
		},
		groupBy: {
			get(): string { return this.contextEnabled ? CONTEXT_ENABLED_STRING : (this.storeModule.getState().groupBy[0] || ''); },
			set(v: string) {
				const newContext = v === CONTEXT_ENABLED_STRING;
				// not grouping by context anymore
				// clear the applied context grouping and apply the regular grouping (if applicable)
				if (v !== CONTEXT_ENABLED_STRING) {
					if (this.storeModule.getState().groupByAdvanced.length) {
						this.storeModule.actions.groupByAdvanced([]); // clear
					}
					const newState = v ? [v] : [];
					const oldState = this.storeModule.getState().groupBy;
					// For some reason there's an extra roundtrip if we don't perform this check
					if (newState.length !== oldState.length || !newState.every(e => oldState.includes(e))) {
						this.storeModule.actions.groupBy(newState);
					}
				}
				// Don't have to do anything when we go from grouping normally to context grouping,
				// that needs to be applied by the user specifically (so they can configure the options before applying)
				// see submitContext

				this.contextEnabled = newContext;
			}
		},
		viewGroup: {
			get(): string|null { return this.storeModule.getState().viewGroup; },
			set(v: string|null) { this.storeModule.actions.viewGroup(v); },
		},
		appliedContextGroups: {
			get(): string[] { return this.storeModule.getState().groupByAdvanced; },
			set(v: string[]) { this.storeModule.actions.groupByAdvanced(v); }
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

			if (this.type === 'hits') {
				// NOTE: grouping on annotations without a forward index is not supported - however has already been checked in the UIStore
				const displayNames = CorpusStore.get.annotationDisplayNames();
				const shownAnnotationIds = UIStore.getState().results.shared.groupAnnotationIds;
				[
					['hit:', 'Hit', ''],
					['wordleft:', 'Before hit', 'before'],
					['wordright:', 'After hit', 'after']
				]
				.forEach(([prefix, groupname, suffix]) =>
					opts.push({
						label: groupname,
						options: shownAnnotationIds.map(id => ({
							label: `Group by ${displayNames[id] || id} <small class="text-muted">${suffix}</small>`,
							value: `${prefix}${id}`
						}))
					})
				);
			}

			// So recreate the groups and add everything that's not in the form into a default fallback group.
			const metadataFields = CorpusStore.get.allMetadataFieldsMap();
			const metadataGroupsToShow: MapOf<Option[]> = {};

			UIStore.getState().results.shared.groupMetadataIds.forEach(id => {
				let {displayName, groupId} = metadataFields[id];
				groupId = groupId || 'Metadata'; // fallback group name

				if (!metadataGroupsToShow[groupId]) {
					metadataGroupsToShow[groupId] = [];
				}

				metadataGroupsToShow[groupId].push({
					value: `field:${id}`,
					label: `Group by ${(displayName || id).replace(groupId, '')} <small class="text-muted">(${groupId})</small>`,
				});
			});

			const metadataOptGroups =
			Object.entries(metadataGroupsToShow)
			.map(([groupName, fieldsInGroup]) => ({
				label: groupName,
				options: fieldsInGroup
			}));

			// If there is only one metadata group to display: do not display the groups's name, instead display only 'Metadata'
			// https://github.com/INL/corpus-frontend/issues/197#issuecomment-441475896
			if (metadataOptGroups.length === 1) {
				metadataOptGroups.forEach(g => g.label = 'Metadata');
			}
			return opts.concat(metadataOptGroups);
		},

		contextSupported(): boolean { return this.type === 'hits'; },
	},
	watch: {
		appliedContextGroups: {
			immediate: true,
			handler(v: string[]) {
				this.unappliedContextGroups = v.concat();
				if (v.length) {
					this.contextEnabled = true;
				}
			}
		},
		contextEnabled(v: boolean) {
			if (v && this.unappliedContextGroups.length === 0) {
				this.createContextGroup();
			}
		},
	},
});
</script>

<style lang="scss">

.groupby-container {
	align-items: center;
	display: inline-flex;
	flex-wrap: nowrap;
	max-width: 100%;
	margin-bottom: 5px;

	&.context-enabled {
		> .groupselect {
			min-width: 0px;

			> button {
				border-top-right-radius: 0px;
				border-bottom-right-radius: 0px;
				border-right-width: 0;
			}
		}
	}
}

.groupby-context-container {
	margin: 5px 0;
}

</style>