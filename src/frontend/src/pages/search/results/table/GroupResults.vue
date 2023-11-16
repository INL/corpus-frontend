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
						:style="{
							width: header.isBar ? '60%' : undefined
						}"
					>
						<v-popover v-if="i === 0" offset="5" style="display:inline-block;">
							<a role="button" title="Column meanings"><span class="fa fa-lg fa-question-circle"/></a>

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
					<tr class="grouprow rounded interactable" :key="row.id" @click="openPreviewConcordances(row.id)">
						<td v-for="col in columns" :key="col.toString()">
							<template v-if="typeof col === 'string'">
								<template v-if="col.indexOf('relative') === -1">{{row[col] != null ? row[col].toLocaleString() : '[unknown]'}}</template> <!-- HACK! all division keys contain spaces for now, probably pretty slow too -->
								<template v-else>{{row[col] != null ? $options.filters.frac2Percent(row[col]) : '[unknown]'}}</template>
							</template>

							<div v-else class="progress group-size-indicator">
								<div class="progress-bar progress-bar-primary"
									:style="{
										'min-width': row[col[0]] ? $options.filters.frac2Percent(row[col[0]] / maxima[col[0]]) : '100%',
										'opacity': row[col[0]] ? 1 : 0.5
									}">{{row[col[1]] ? row[col[1]].toLocaleString() : '[unknown]'}}</div>
							</div>
						</td>
					</tr>
					<tr class="concordance" :key="`${row.id}-concordances`" v-if="concordances[row.id] && concordances[row.id].open">
						<td colspan="10">
							<div class="well-light">
								<div class="concordance-controls clearfix">
									<button type="button" class="btn btn-sm btn-primary open-concordances" :disabled="disabled" @click="openFullConcordances(row.id, row.displayName)"><span class="fa fa-angle-double-left"></span> View detailed concordances</button>
									<button type="button" v-if="!allConcordancesLoaded(row.id)" :disabled="!canLoadConcordances(row.id)" class="btn btn-sm btn-default" @click="loadPreviewConcordances(row.id)">
										<template v-if="concordances[row.id].request != null">
											<span class="fa fa-spin fa-spinner"></span> Loading...
										</template>
										<template v-else>Load more concordances</template>
									</button>

									<button type="button" class="close close-concordances" title="close" @click="openPreviewConcordances(row.id)"><span>&times;</span></button>
								</div>

								<div v-if="concordances[row.id].error != null" class="text-danger"><span v-html="concordances[row.id].error"></span></div>

								<template v-if="type === 'hits' && concordances[row.id].concordances.length > 0">
									<div class="clearfix" style="border-bottom:1px solid #ddd;">
										<div class="col-xs-5 text-right"><strong>{{leftLabel}}</strong></div>
										<div class="col-xs-2 text-center" style="padding: 0;"><strong>Hit</strong></div>
										<div class="col-xs-5"><strong>{{rightLabel}}</strong></div>
									</div>
									<div v-for="(conc, index) in concordances[row.id].concordances" :key="index" class="clearfix concordance">
									<template v-if="concordanceAsHtml">
										<div class="col-xs-5 text-right" v-html="conc.left"></div>
										<div class="col-xs-2 text-center"><strong v-html="conc.hit"></strong></div>
										<div class="col-xs-5" v-html="conc.right"></div>
									</template>
									<template v-else>
										<div class="col-xs-5 text-right">&hellip; {{conc.left}}</div>
										<div class="col-xs-2 text-center"><strong>{{conc.hit}}&nbsp;</strong></div>
										<div class="col-xs-5">{{conc.right}} &hellip;</div>
									</template>
									</div>
								</template>
								<template v-else-if="type === 'docs' && concordances[row.id].concordances.length > 0">
									<table>
										<thead>
											<tr>
												<th style="width: 80%">Document</th>
												<th style="width: 20%" v-if="concordances[row.id].hasHits">Hits</th>
											</tr>
										</thead>
										<tbody>
											<tr v-for="(conc, index) in concordances[row.id].concordances" :key="index">
												<td><a :href="conc.href" target="_blank">{{conc.title}}</a></td>
												<td v-if="concordances[row.id].hasHits"><strong>{{conc.hits}}</strong></td>
											</tr>
										</tbody>
									</table>
								</template>
							</div>
						</td>
					</tr>
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

import * as Api from '@/api';
import {snippetParts, getDocumentUrl} from '@/utils';

import * as BLTypes from '@/types/blacklabtypes';

import SelectPicker from '@/components/SelectPicker.vue';
import frac2Percent from '@/mixins/fractionalToPercent';

/** Used to show a help tooltip explaining what data is represented by a column, also for developer documentation :) */
const definitions = [
	['c',   '[corpus]',            'The entire corpus'],
	['sc',  '[subcorpus]',         'A set of documents within c. Defined by a specific set of metadata.'],
	['gsc', '[grouped subcorpus]', 'A set of documents within sc. Creating by matching a set of metadata against documents in sc. If not grouping by metadata, gsc=sc'],
	['r',   '[results]',           'A set of documents within sc. Created by matching a (optional) cql pattern against documents in sc. If no cql is used, r=sc'],
	['gr',  '[grouped results]',   'A set of documents within r. Created by matching a set of metadata against documents in r.'],

	['*.d', '[documents]',         'Number of documents in a collection'],
	['*.t', '[tokens]',            'Number of tokens in a collections'],
	['*.h', '[documents]',         'Number of hits in a collection'],
];

/**
 * The BlackLab api response for groups has data in several different places.
 * We unpack and simplify it a little so that every entry has the same data available. Names are according to the definitions above
 */
interface GroupData {
	id: string;
	displayname: string;

	// aggregate results
	'r.d': number;
	'r.t': number;
	'r.h'?: number;         // NOTE: unavailable for queries without cql pattern

	/** Documents in group */
	'gr.d': number;
	/** Tokens in group */
	'gr.t'?: number; // FIXME remove optional flag when Jan implements
	/** Hits in group */
	'gr.h'?: number;        // NOTE: unavailable for queries without cql pattern

	// group within total search space
	'gsc.d'?: number;       // NOTE: might be unknown (in rare cases, 0 is returned for groups where the metadata value is unknown)
	'gsc.t'?: number;       // NOTE: might be unknown (in rare cases, 0 is returned for groups where the metadata value is unknown)

	// total search space
	'sc.d'?: number; // FIXME remove optional flag when Jan implements
	'sc.t'?: number; // FIXME remove optional flag when Jan implements
}

/** For UI purposes: holds derived statistics about groups. E.G. size of this group vs the largest group. */
interface RowData extends GroupData {
	// adds to 1 across all groups
	'relative group size [gr.d/r.d]': number;
	'relative group size [gr.t/r.t]'?: number; // FIXME remove option flag when Jan implements
	// adds to 1 across all groups - optional, only when cql pattern available
	'relative group size [gr.h/r.h]'?: number;

	'relative frequency (docs) [gr.d/gsc.d]'?: number; // optional because subcorpus might not be calculable
	'relative frequency (tokens) [gr.t/gsc.t]'?: number; // optional because subcorpus might not be calculable
	'relative frequency (hits) [gr.h/gsc.t]'?: number; // optional because subcorpus might not be calculable and hits are optional

	'relative frequency (docs) [gr.d/sc.d]'?: number; // FIXME optional because subcorpus is unknown for metadata grouped requests, wait for Jan
	'relative frequency (tokens) [gr.t/sc.t]'?: number; // FIXME optional because subcorpus is unknown for metadata grouped requests, wait for Jan

	'average document length [gr.t/gr.d]'?: number;
}

/** What properties are available to display in the columns */
type Column = keyof RowData;
/**
 * A "table" layout is just an array of columns.
 * A column in our case is a cell holding a number, or a horizontal bar (the table represents a sideways bar chart)
 * The subarray represents a bar, and a string ("column") represents a cell holding a number (like rowData[cell.key])
 */
type TableDef = Array<Column|[Column, Column]>;

/**
 * The user can pick how and what data they want to show:
 * This object holds the various available column layouts for the table.
 *
 * It is structures as follows:
 * Based on what the user has searched for, there are several ways of displaying the data
 * - At the top is the distinction of what we're grouping/displaying: hits or docs
 * - Below that is the distinction of what is being grouped on: document metadata, or a hit property (such as 'lemma' or 'pos')
 * - Then below THAT, is the display mode chose by the user. These are the same data, just different sets of columns.
 *     Usually one wide table containing all relevant properties of the groups
 *     Then the rest are the same columns but in a wider view using a horizontal bar to illustrate the magnitude of the group,
 *     instead of just a cell with a fractional number.
 */
const displayModes: {
	hits: {
		metadata: {
			'table': TableDef,
			'docs': TableDef,
			'hits': TableDef,
			'relative docs': TableDef,
			'relative hits': TableDef,
		},
		annotation: {
			'table': TableDef,
			'hits': TableDef,
		},
	},
	docs: {
		metadata: {
			'table': TableDef,
			'docs': TableDef,
			'tokens': TableDef
		}
	}
} = {
	hits: {
		metadata: {
			'table': [
				'displayname',
				'gr.d',
				'gr.h',
				'gsc.d',
				'gsc.t',
				'relative frequency (docs) [gr.d/gsc.d]',
				'relative frequency (hits) [gr.h/gsc.t]',
			],

			'docs': [
				'displayname',
				['relative group size [gr.d/r.d]', 'gr.d'],
				'relative group size [gr.d/r.d]',
			],

			'hits': [
				'displayname',
				['relative group size [gr.h/r.h]', 'gr.h'],
				'relative group size [gr.h/r.h]',
			],

			'relative docs': [
				'displayname',
				['relative frequency (docs) [gr.d/gsc.d]', 'gr.d'],
				'relative frequency (docs) [gr.d/gsc.d]'
			],

			'relative hits': [
				'displayname',
				['relative frequency (hits) [gr.h/gsc.t]', 'gr.h'],
				'relative frequency (hits) [gr.h/gsc.t]'
			],
		},
		annotation: {
			'table': [
				'displayname',
				'gr.h',
				'relative frequency (hits) [gr.h/gsc.t]'
			],
			'hits': [
				'displayname',
				['relative frequency (hits) [gr.h/gsc.t]', 'gr.h'],
				'relative frequency (hits) [gr.h/gsc.t]'
			],
		},
	},
	docs: {
		metadata: {
			'table': [
				'displayname',
				'gr.d',
				'gr.t',
				'relative frequency (docs) [gr.d/gsc.d]',
				'relative frequency (tokens) [gr.t/gsc.t]',
				'average document length [gr.t/gr.d]',
			],
			'docs': [
				'displayname',
				['relative group size [gr.d/r.d]', 'gr.d'],
				'relative group size [gr.d/r.d]'
			],
			'tokens': [
				'displayname',
				['relative frequency (tokens) [gr.t/gsc.t]', 'gr.t'],
				'relative frequency (tokens) [gr.t/gsc.t]'
			],
		}
	}
};


/**
 * For every possible column (1 per key in the RowData type) a column header is defined.
 * It holds the display name, possible tooltip, and optionally what to sort on should the user click the header
 * (e.g. the column header for the "size" property sorts the groups based on size when clicked by the user - analogous to the Hits and Docs tables)
 */
const tableHeaders: {
	[K in ('hits'|'docs'|'default')]: {
		[ColumnId in keyof RowData]?: {
			label?: string;
			title?: string;
			/** annotation, meta field or other property to sort on should this header be clicked by the user */
			sortProp?: string;
		}
	}
} = {
	default: {
		'displayname': {
			label: 'Group',
			sortProp: 'identity'
		},
		'average document length [gr.t/gr.d]': {
			label: 'Average document length',
			title: '(gr.t/gr.d)'
		},
		'gsc.d': {
			label: '#all docs in current group',
			title: '(gsc.d) - This includes documents without hits'
		},
		'gr.t': {
			label: '#tokens in group',
			title: '(gr.t) - Combined length of all documents with hits in this group',
		},
		'gr.h': {
			label: '#hits in group',
			title: '(gr.h)'
		},
		'relative frequency (docs) [gr.d/gsc.d]': {
			label: 'Relative frequency (docs)',
			title: '(gr.d/gsc.d) - Note that gsc.d = sc.d when not grouped by metadata'
		},
		'relative frequency (hits) [gr.h/gsc.t]': {
			label: 'Relative frequency (hits)',
			title: '(gr.h/gsc.t) - Note that gsc.t = sc.t when not grouped by metadata'
		},
		'relative frequency (tokens) [gr.t/gsc.t]': {
			label: 'Relative frequency (tokens)',
			title: '(gr.t/gsc.t) - Note that gsc.t = sc.t when not grouped by metadata'
		}
	},
	hits: {
		'gr.d': {
			label: '#docs with hits in current group',
			title: '(gr.d)',
		},
		'gr.h': {
			sortProp: 'size'
		},
		'gsc.t': {
			label: '#all tokens in current group',
			title: '(gr.t)',
		},

		'relative group size [gr.d/r.d]': {
			label: 'Relative group size (docs)',
			title: '(gr.d/r.d) - Number of found documents in this group relative to total number of found documents',
		},
		'relative group size [gr.h/r.h]': {
			label: 'Relative group size (hits)',
			title: '(gr.h/r.h) - Number of hits in this group relative to total number hits',
		},
	},
	docs: {
		'gr.d': {
			label: '#docs in group',
			title: '(gr.d)',
			sortProp: 'size'
		},
		'relative group size [gr.d/r.d]': {
			label: 'Relative frequency (docs)',
			title: '(gr.d/r.d)',
		},
	},
};

// Helpers to compute the largest number in the currently displayed result set.
// E.G. largest occurance of the RowData['gr.d'] property.
// This is required to scale the bars in the horizontal barchart view. The largest occurance of a value there has 100% width.
// NOTE: sometimes we know the absolute maximum across all groups (such as the size), because BlackLab tells us,
// but sometimes we only have the maximum value in the currently displayed page (such as for properties we compute locally, such as relative sizes).
// Fixing this would be a substantial amount of extra work for BlackLab.
type LocalMaxima = {  [P in keyof RowData]-?: number extends RowData[P] ? number : never; };
class MaxCounter {
	public values: {[key: string]: number} = {};

	public add(key: string, v?: number) {
		if (v == null || !(typeof v === 'number')) {
			return;
		}
		this.values[key] = Math.max(this.values[key] || 0, v);
	}
}

export default Vue.extend({
	components: { SelectPicker },
	filters: { frac2Percent },
	props: {
		results: Object as () => BLTypes.BLHitGroupResults|BLTypes.BLDocGroupResults,
		sort: String as () => null|string,
		disabled: Boolean
	},
	data: () => ({
		definitions,

		concordances: {} as {
			[key: string]: {
				available: number;
				request: null|Promise<BLTypes.BLSearchResult>;
				error: null|string;
				open: boolean;
				// TODO
				hasHits?: boolean, // only when this.type === docs
				concordances: Array<
					{ // when this.type === hits
						left: string;
						hit: string;
						right: string;
					}|{ // when this.type === docs
						title: string;
						hits?: number;
						href: string;
					}
				>;
			}
		},
	}),
	computed: {
		type(): 'hits'|'docs' { return BLTypes.isDocGroupsOrResults(this.results) ? 'docs' : 'hits'; },
		storeModule(): ReturnType<typeof ResultsStore['getOrCreateModule']> { return ResultsStore.getOrCreateModule(this.type); },

		// Display variables not influenced by results
		concordanceAnnotationId(): string { return UIStore.getState().results.shared.concordanceAnnotationId; },
		transformSnippets() { return UIStore.getState().results.shared.transformSnippets; },
		concordanceAsHtml(): boolean { return UIStore.getState().results.shared.concordanceAsHtml; },

		textDirection: CorpusStore.get.textDirection,

		leftLabel(): string { return this.textDirection === 'ltr' ? 'Before' : 'After'; },
		rightLabel(): string { return this.textDirection === 'ltr' ? 'After' : 'Before'; },
		leftIndex(): number { return this.textDirection === 'ltr' ? 0 : 2; },
		rightIndex(): number { return this.textDirection === 'ltr' ? 2 : 0; },

		/** True if the results were created from a search containing a cql pattern, e.g. not just a raw document query */
		isTokenResults(): boolean { return !!this.results.summary.searchParam.patt; },

		// This does not work, as the rules on when subcorpusSize is included are different for /docs and /hits?
		// isGroupedByMetadata(): boolean { return this.type === 'docs' ? !this.results.summary.subcorpusSize : !this.results.summary.subcorpusSize; },
		// isGroupedByAnnotation(): boolean { return !!this.results.summary.subcorpusSize; },
		// groupMode(): 'annotation'|'metadata'|'mixed' {
		// 	if (this.isGroupedByMetadata && this.isGroupedByAnnotation) { return 'mixed'; }
		// 	else if (this.isGroupedByAnnotation) { return 'annotation'; }
		// 	else if (this.isGroupedByMetadata) { return 'metadata'; }
		// 	throw new Error('In GroupResults but results not grouped?');
		// },

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

		rows(): RowData[] { return this._rowsData.rows; },
		maxima(): LocalMaxima { return this._rowsData.maxima; },

		/** Convert results into ready to display bits of info */
		_rowsData(): {
			rows: RowData[],
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
						displayname: this.decodePropertyValue(g.identity) || '[unknown]',

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
						displayname: this.decodePropertyValue(g.identity) || '[unknown]',

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

			const rows = stage1.map<RowData>((row: GroupData) => {
				const r: RowData = {
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
		openPreviewConcordances(id: string) {
			const cache = this.concordances[id] = this.concordances[id] || {
				open: false,
				available: Number.MAX_SAFE_INTEGER,
				concordances: [],
				request: null,
				hasHits: this.type === 'docs' ? false : undefined,
			};

			cache.open = !cache.open;
			if (cache.open && cache.request == null && cache.concordances.length === 0) {
				this.loadPreviewConcordances(id);
			}
		},
		canLoadConcordances(id: string) { const conc = this.concordances[id]; return conc && conc.request == null && conc.available > conc.concordances.length; },
		allConcordancesLoaded(id: string) { const conc = this.concordances[id]; return conc && conc.available <= conc.concordances.length; },
		loadPreviewConcordances(id: string) {
			const cache = this.concordances[id];

			if (cache.request || cache.available! <= cache.concordances.length) {
				return;
			}

			// Technically requests could come in after we get a new set of groups to display
			// but it's not an issue, as we tie them to the groupId and the new groups should have new ids.

			// make a copy of the parameters so we don't clear them for all components using the summary
			const requestParameters: BLTypes.BLSearchParameters = Object.assign({}, this.results.summary.searchParam, {
				number: 20,
				first: cache.concordances.length,
				viewgroup: id,
				// Do not clear sample/samplenum/samplecount, or we could retrieve concordances that weren't included in the input results for the grouping
				sort: undefined,
			} as BLTypes.BLSearchParameters);

			ga('send', 'event', 'results', 'concordances/load', id, requestParameters.first+requestParameters.number);

			const apiCall = this.type === 'hits' ? Api.blacklab.getHits : Api.blacklab.getDocs;
			const req: Promise<BLTypes.BLSearchResult> = apiCall(INDEX_ID, requestParameters).request;
			cache.request = req;
			cache.error = null;

			req.then(res => {
				if (this.type === 'hits') {
					const data = res as BLTypes.BLHitResults;
					cache.available = data.summary.numberOfHitsRetrieved;
					data.hits.forEach(hit => {
						if (this.transformSnippets) {
							this.transformSnippets(hit);
						}

						const parts = snippetParts(hit, this.concordanceAnnotationId);
						cache.concordances.push({
							left: parts[this.leftIndex],
							hit: parts[1],
							right: parts[this.rightIndex],
						});
					});
				} else {
					const data = res as BLTypes.BLDocResults;
					cache.available = data.summary.numberOfDocsRetrieved;
					cache.hasHits = cache.hasHits || (data.docs.length > 0 && data.docs[0].numberOfHits != null);

					const getSummary = UIStore.getState().results.shared.getDocumentSummary;
					data.docs.forEach(doc => {
						cache.hasHits = cache.hasHits || doc.numberOfHits != null;
						cache.concordances.push({
							title: getSummary(doc.docInfo, data.summary.docFields),
							hits: doc.numberOfHits,
							href: getDocumentUrl(doc.docPid, data.summary.searchParam.patt || undefined, data.summary.searchParam.pattgapdata || undefined),
						});
					});
				}
			})
			.catch((err: Api.ApiError) => {
				cache.error = UIStore.getState().global.errorMessage(err, 'concordances');
				ga('send', 'exception', { exDescription: err.message, exFatal: false });
			})
			.finally(() => cache.request = null);
		},

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
		results: {
			immediate: true,
			handler(newVal: BLTypes.BLHitGroupResults|BLTypes.BLDocGroupResults, oldVal: BLTypes.BLHitGroupResults|BLTypes.BLDocGroupResults) {
				const newConcordances = {} as any;

				(BLTypes.isHitGroups(newVal) ? newVal.hitGroups : newVal.docGroups).forEach((group: BLTypes.BLGroupResult) => {
					newConcordances[group.identity] = null;
				});
				this.concordances = newConcordances;
			}
		},
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
