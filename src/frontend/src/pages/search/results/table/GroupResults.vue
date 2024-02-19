<template>
	<div>
		<div class="crumbs-totals">
			<slot name="breadcrumbs"/>
			<slot name="totals"/>
		</div>
		<slot name="groupBy"/>
		<slot name="pagination"/>

		<div class="form-group">
			<div class="btn-group" style="margin: auto;">
				<button v-for="option in chartModeOptions"
					type="button"
					:class="['btn btn-default btn-sm', {'active': chartMode === option}]"
					:key="option"
					@click="chartMode = option"
				>{{option}}</button>
			</div>
		</div>


		<table class="group-table">
			<thead>
				<tr class="rounded">
					<th v-for="(header, i) in headers"
						:key="header.key"
						:title="header.title"
						:style="header.isBar ? 'width: 60%;' : ''"
					>
						<v-popover v-if="i === 0" offset="5" style="display:inline-block;">
							<a role="button" title="Column meanings"><span class="fa fa-lg fa-question-circle"></span></a>
							<template slot="popover">
								<table class="table table-condensed" style="table-layout:auto; max-width:calc(100vw - 75px);width:500px;">
									<tbody>
										<tr v-for="(row, i) in definitions" :key="i">
											<td v-for="(cell, j) in row" :key="j">{{cell}}</td>
										</tr>
									</tbody>
								</table>
							</template>
						</v-popover>

						<a v-if="header.sortProp"
							role="button"
							:class="['sort', {'disabled':disabled}]"
							:title="`${header.title} (click to sort)`"
							@click="changeSort(header.sortProp)"
						>
							{{header.label}}
						</a>
						<template v-else>{{header.label}}</template>
					</th>
				</tr>
			</thead>
			<tbody>
				<template v-for="row in rows">
					<GroupRowBar :key="row.id"
						:data="row"
						:columns="columns"
						:maxima="maxima"
						@click="row.open = !row.open"
					/>
					<GroupRowConcordance :key="`${row.id}-concordances`"
						:data="row"
						:query="results.summary.searchParam"
						:type="type"
						:disabled="disabled"
						:annotation="concordanceAnnotationId"
						:dir="textDirection"
						:html="concordanceAsHtml"
					/>
				</template>
			</tbody>
		</table>

		<hr>
		<div class="text-right">
			<slot name="sort"/>
			<slot name="export"/>
		</div>

	</div>
</template>

<script lang="tsx">
import Vue from 'vue';

import * as CorpusStore from '@/store/search/corpus';
import * as ResultsStore from '@/store/search/results/views';
import * as UIStore from '@/store/search/ui';

import * as BLTypes from '@/types/blacklabtypes';

import SelectPicker from '@/components/SelectPicker.vue';

import GroupRowBar from './GroupRowBar.vue';
import GroupRowConcordance from './GroupRowConcordance.vue';
import { displayModes, TableDef, tableHeaders, definitions, GroupRowdata, GroupData, MaxCounter, LocalMaxima } from '@/pages/search/results/table/groupTable';


export default Vue.extend({
	components: { SelectPicker,GroupRowBar, GroupRowConcordance },

	props: {
		results: Object as () => BLTypes.BLHitGroupResults|BLTypes.BLDocGroupResults,
		sort: String as () => null|string,
		disabled: Boolean
	},
	data: () => ({
		definitions,
	}),
	computed: {
		type(): 'hits'|'docs' { return BLTypes.isDocGroupsOrResults(this.results) ? 'docs' : 'hits'; },
		storeModule(): ReturnType<typeof ResultsStore['getOrCreateModule']> { return ResultsStore.getOrCreateModule(this.type); },

		// Display variables not influenced by results
		concordanceAnnotationId(): string { return UIStore.getState().results.shared.concordanceAnnotationId; },
		transformSnippets() { return UIStore.getState().results.shared.transformSnippets; },
		concordanceAsHtml(): boolean { return UIStore.getState().results.shared.concordanceAsHtml; },

		textDirection: CorpusStore.get.textDirection,

		/** True if the results were created from a search containing a cql pattern, e.g. not just a raw document query */
		isTokenResults(): boolean { return !!this.results.summary.searchParam.patt; },

		groupMode(): 'annotation'|'metadata' {
			// eventually needs a mixed mode for when grouping on metadata + annotation values
			// but we can't detect this from the blacklab response alone since it looks the same as when grouping on metadata only
			const groupMode =
				this.type === 'docs' ? 'metadata' :
				this.results.summary.searchParam.group!.match(/^(field|decade):/) ? 'metadata' : 'annotation'
			return groupMode;
		},

		chartModeOptions(): string[] {
			// FIXME hardcoded
			const options = Object.keys((displayModes as any)[this.type][this.groupMode]);
			if (this.type === 'docs' && this.isTokenResults) {
				// Hide the relative tokens view when results are filtered based on a cql pattern
				return options.filter(o => o !== 'tokens');
			}
			return options;
		},
		chartMode: {
			get(): string { return this.storeModule.getState().groupDisplayMode || this.chartModeOptions[1]; },
			set(v: string): void { this.storeModule.actions.groupDisplayMode(v === this.chartModeOptions[1] ? null : v); },
		},

		/** Columns in the table */
		columns(): TableDef {
			const columns = (displayModes as any)[this.type][this.groupMode][this.chartMode] as TableDef;
			if (!columns) {
				throw new Error(`No columns defined for ${this.type} grouped by ${this.groupMode} shown as ${this.chartMode}`);
			}

			// FIXME hardcoded
			if (this.type === 'docs' && this.chartMode === 'table' && this.isTokenResults) {
				// Hide the relative tokens column when the results are filtered based on a cql pattern...
				return columns.filter(c => c !== 'relative frequency (tokens) [gr.t/gsc.t]');
			}
			return columns;
		},
		/**
		 * Map the column to a pretty header with a display name and tooltip information etc,
		 * the description for a column containing the same information might be different based on what we're displaying
		 */
		headers(): Array<{key: string, label: string, title?: string, isBar: boolean, sortProp?: string}> {
			const r = this.columns.map(c => {
				const headerId = typeof c === 'string' ? c : c[1];

				const viewHeader = tableHeaders[this.type][headerId] || {};
				const defaultHeader = tableHeaders.default[headerId] || {};
				const fallback = {
					label: headerId,
					title: undefined
				};

				return {
					key: headerId,
					label: viewHeader.label || defaultHeader.label || fallback.label,
					title: viewHeader.title || defaultHeader.title || fallback.title,
					isBar: typeof c !== 'string',
					sortProp: viewHeader.sortProp || defaultHeader.sortProp || undefined
				};
			});

			return r;
		},

		rows(): GroupRowdata[] { return this._rowsData.rows; },
		maxima(): LocalMaxima { return this._rowsData.maxima; },

		/** Convert results into ready to display bits of info */
		_rowsData(): {
			rows: GroupRowdata[],
			maxima: LocalMaxima
		} {
			const max = new MaxCounter();

			const stage1: GroupData[] = [];
			if (this.type === 'hits') {
				const {summary, hitGroups} = this.results as BLTypes.BLHitGroupResults;

				// we know the global maximum of this property, so might as well use it.
				max.add('gr.h', summary.largestGroupSize);

				hitGroups.forEach(g => {
					stage1.push({
						id: g.identity || '[unknown]',
						size: g.size,
						displayname: this.decodePropertyValue(g.identity) || '[unknown]',
						open: false,

						'r.d': summary.numberOfDocs,
						'r.t': summary.tokensInMatchingDocuments!, // FIXME augment request to make this available
						'r.h': summary.numberOfHits,

						'gr.d': g.numberOfDocs,
						'gr.t': undefined, // TODO wait for jan
						'gr.h': g.size,

						'gsc.d': (g.subcorpusSize ? g.subcorpusSize.documents : summary.subcorpusSize!.documents) || undefined,
						'gsc.t': (g.subcorpusSize ? g.subcorpusSize.tokens : summary.subcorpusSize!.tokens) || undefined,

						'sc.d': summary.subcorpusSize ? summary.subcorpusSize.documents : undefined, // TODO jan might make always available, remove check
						'sc.t': summary.subcorpusSize ? summary.subcorpusSize.tokens : undefined
					});
				});
			} else {
				const {summary, docGroups} = this.results as BLTypes.BLDocGroupResults;

				// we know the global maximum of this property, so might as well use it.
				max.add('gr.d', summary.largestGroupSize);

				docGroups.forEach(g => {
					// both are 0 in some cases, so mind that
					const sdocs = (g.subcorpusSize ? g.subcorpusSize.documents : summary.subcorpusSize!.documents) || undefined;
					const stokens = (g.subcorpusSize ? g.subcorpusSize.tokens : summary.subcorpusSize!.tokens) || undefined;
					const reldocs = g.size / summary.numberOfDocs;
					const reltokens = /*stokens ? g.numberOfTokens / stokens :*/ undefined; // can't really do more with this, we don't have the number of tokens in docs in this group, probably?
					const sreldocs = sdocs ? g.size / sdocs : undefined;
					const sreltokens = stokens ? g.numberOfTokens / stokens : undefined;

					stage1.push({
						id: g.identity,
						size: g.size,
						displayname: this.decodePropertyValue(g.identity) || '[unknown]',
						open: false,

						'r.d': summary.numberOfDocs,
						'r.t': summary.tokensInMatchingDocuments!, // FIXME augment request to make this available
						'r.h': undefined, // summary.numberOfHits, TODO add when jan makes available

						'gr.d': g.size,
						'gr.t': g.numberOfTokens,
						'gr.h': undefined, // g.numberOfHits, TODO add when jan makes available

						'gsc.d': (g.subcorpusSize ? g.subcorpusSize.documents : summary.subcorpusSize!.documents) || undefined,
						'gsc.t': (g.subcorpusSize ? g.subcorpusSize.tokens : summary.subcorpusSize!.tokens) || undefined,

						'sc.d': summary.subcorpusSize ? summary.subcorpusSize.documents : undefined, // TODO jan might make always available, remove null check and make non-optional if/when
						'sc.t': summary.subcorpusSize ? summary.subcorpusSize.tokens : undefined
					});
				});
			}

			const rows = stage1.map<GroupRowdata>((row: GroupData) => {
				const r: GroupRowdata = {
					...row,
					'relative group size [gr.d/r.d]': row['gr.d'] / row['r.d'],
					'relative group size [gr.t/r.t]': row['gr.t'] ? row['gr.t']! / row['r.t'] : undefined,
					'relative group size [gr.h/r.h]': row['gr.h'] && row['r.h'] ? row['gr.h']! / row['r.h']! : undefined,

					'relative frequency (docs) [gr.d/gsc.d]':   row['gsc.d']                 ? row['gr.d']  / row['gsc.d']! : undefined,
					'relative frequency (tokens) [gr.t/gsc.t]': row['gr.t']  && row['gsc.t'] ? row['gr.t']! / row['gsc.t']! : undefined,
					'relative frequency (hits) [gr.h/gsc.t]':   row['gr.h']  && row['gsc.t'] ? row['gr.h']! / row['gsc.t']! : undefined,

					'relative frequency (docs) [gr.d/sc.d]':   row['sc.d'] ? row['gr.d'] / row['sc.d']! : undefined,
					'relative frequency (tokens) [gr.t/sc.t]': row['gr.t'] && row['sc.t'] ? row['gr.t']! / row['sc.t']! : undefined,

					'average document length [gr.t/gr.d]': row['gr.t'] ? Math.round(row['gr.t']! / row['gr.d']) : undefined,
				};

				Object.entries(r).forEach(([k, v]) => max.add(k, v));
				return r;
			});

			return {
				rows,
				maxima: max.values as any
			};
		},

		sortModel: {
			get(): string|null { return this.sort; },
			set(v: string|null): void { this.$emit('sort', v); }
		},
	},
	methods: {
		changeSort(payload: string) {
			if (!this.disabled) {
				this.$emit('sort', payload === this.sort ? '-'+payload : payload);
			}
		},

		/* EVENTS */
		openFullConcordances(id: string, displayName: string) {
			this.$emit('viewgroup', {id, displayName});
		},

		decodePropertyValue(v: string): string {
			function decode(value: string[], skipParts: number, unescape: boolean) {
				value.splice(0, skipParts);
				if (unescape) value = value.map(p => p.replace(/\$CL/g, ':').replace(/\$CM/g, ',').replace(/\$DL/g, '$'));
				return value.join(' ');
			}

			return v
			.split(',')
			.map(p => {
				const [type, ...rest] = p.split(':');
				switch (type) {
					case 'cwo':
					case 'cws':
					case 'cwsr':
						return decode(rest, 2, true);
						//  reverse! (apparently)
					case 'dec': // no sens - no unescape
					case 'int': // no sens -- no unescape
					case 'doc': // no sens - no unescape
						return decode(rest, 0, false);
					case 'str': // no sens -- do unescape
						return decode(rest, 0, true);
					default:
						// unknown property - newer version of blacklab? make some best effort guess.
						const valueMightHaveSensitivitySpecifier = rest.includes('i') || rest.includes('s');
						return decode(rest, valueMightHaveSensitivitySpecifier ? 2 : 0, valueMightHaveSensitivitySpecifier);
				}
			})
			.join('·');
		}
	},
	watch: {
		chartModeOptions(v: string[]) {
			if (!v.includes(this.chartMode)) {
				this.chartMode = 'table';
			}
		}
	}
});
</script>

<style lang="scss">

.group-table {
	table-layout: auto;

	th {
		vertical-align: top;
	}
}

.grouprow {
	border-bottom: 2px solid transparent;
}

.group-size-indicator {
	cursor: pointer;
	margin: 0;

	background: linear-gradient(to right, hsla(0, 0%, 91%, 1) 40%, white 100%);

	&:hover {
		background: #d8d8d8;
	}

	> .progress-bar {
		background-image: linear-gradient(to right, rgba(0,0,0,0.15) 0px, rgba(0,0,0,0) 250px);
		// Do not shrink smaller than the text inside the bar.
		// Greater widths are set using min-width.
		padding: 0px 2px;
		width: auto;
		white-space: nowrap;
	}
}

.concordance-controls {
	margin-bottom: 8px;
}

.well-light {
	background: rgba(255,255,255,0.8);
	border: 1px solid #e8e8e8;
	border-radius: 4px;
	box-shadow: inset 0 1px 2px 0px rgba(0,0,0,0.1);
	margin-bottom: 8px;
	padding: 8px
}

</style>
