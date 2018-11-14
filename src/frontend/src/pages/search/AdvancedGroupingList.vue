<template>
	<div>
		<AdvancedGroupingEditor v-for="(group, index) in groups"
			:key="index"

			@delete="removeGroup(index)"

			v-model="groups[index]"
		/>
		<button type="button" class="btn btn-default" @click="addGroup" style="margin: 0 auto; display: block;" title="Add group criteria">+</button>
		<button type="button" class="btn btn-default" @click="submit">group</button>
	</div>
</template>

<script lang="ts">
import Vue from 'vue';

import * as CorpusStore from '@/store/corpus';

import {default as AdvancedGroupingEditor, AdvancedGroupSettings} from '@/pages/search/AdvancedGroupingEditor.vue';

export default Vue.extend({
	components: {
		AdvancedGroupingEditor
	},
	props: {
		value: Array as () => string[]
	},
	data: () => ({
		groups: [] as AdvancedGroupSettings[],
	}),
	watch: {
		value: {
			immediate: true,
			handler(value: string[]) {
				this.groups = value.map(v => this.getAdvancedGroupFromString(v)).filter(v => v != null) as AdvancedGroupSettings[];
				//debug code
				if (this.groups.length === 0) {
					this.addGroup();
				}
			}
		}
	},
	methods: {
		submit() {
			this.$emit('input', this.groups.map(g => this.getAdvancedGroupString(g)));
		},
		addGroup() {
			this.groups.push({
				annotation: CorpusStore.get.firstMainAnnotation().id,
				caseSensitive: false,
				context: 'hit',
				start: 1,
				end: 5,
				fromEndOfHit: false
			});
		},
		removeGroup(index: number) {
			this.groups.splice(index, 1);
		},

		getAdvancedGroupString(group: AdvancedGroupSettings): string {
			// See http://inl.github.io/BlackLab/blacklab-server-overview.html#sorting-grouping-filtering-faceting
			let contextLetter: string;
			switch (group.context) {
				case 'before': contextLetter = 'L'; break; // Left
				case 'hit': contextLetter = (!group.fromEndOfHit ? 'H' : 'E'); break; // Hit, End, respectively
				case 'after': contextLetter = 'R'; break; // Right
				default: throw new Error('Unknown context option ' + group.context + ' for advanced grouping');
			}

			return `context:${group.annotation}:${group.caseSensitive ? 's' : 'i'}:${contextLetter}${group.start}-${group.end}`;
		},

		getAdvancedGroupFromString(group: string): AdvancedGroupSettings|null {
			// See http://inl.github.io/BlackLab/blacklab-server-overview.html#sorting-grouping-filtering-faceting
			const patt = /context:(\w+):(s|i):(L|R|H|E)(\d+)\-(\d+)/;

			const match = group.match(patt);
			if (match == null) {
				return null;
			}

			const annotation = match[1];
			const caseSensitive = match[2] === 's';
			const contextLetter = match[3] as 'L'|'R'|'H'|'E';
			const start = Number.parseInt(match[4], 10);
			const end = Number.parseInt(match[5], 10);
			const fromEndOfHit = contextLetter === 'E';

			// just use the displaynames as it's already a nice dictionary of all annotations
			// we can use to verify the annotation specified in the group actually exists.
			if (CorpusStore.get.annotationDisplayNames()[annotation] == null) {
				return null; // invalid annotation
			}

			let context: AdvancedGroupSettings['context'];
			switch (contextLetter) {
				case 'L': context = 'before'; break;
				case 'R': context = 'after'; break;
				case 'H':
				case 'E': context = 'hit'; break;
				default: return null; // can't happen but whatever
			}

			return {
				annotation,
				caseSensitive,
				context,
				end,
				fromEndOfHit,
				start
			};
		}
	}
})
</script>

<style lang="scss">

</style>