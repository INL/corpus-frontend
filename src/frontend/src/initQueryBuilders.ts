// import 'bootstrap';
// import 'bootstrap-select';
// import 'bootstrap-select/dist/css/bootstrap-select.css';

import $ from 'jquery';

import {QueryBuilder, AttributeDef as QueryBuilderAttributeDef} from '@/modules/cql_querybuilder';
import * as RootStore from '@/store/search/';
import * as CorpusStore from '@/store/search/corpus';
import * as UIStore from '@/store/search/ui';
import * as PatternStore from '@/store/search/form/patterns';
import debug, {debugLog} from '@/utils/debug';

import { getAnnotationSubset } from '@/utils';
import { Option } from './types/apptypes';

// Init the querybuilder with the supported attributes/properties
export async function initQueryBuilders(): Promise<QueryBuilder[]> {
	debugLog('Begin initializing querybuilder(s)');

	const first = getAnnotationSubset(
		UIStore.getState().search.advanced.searchAnnotationIds,
		CorpusStore.get.annotationGroups(),
		CorpusStore.get.allAnnotationsMap(),
		'Search',
		CorpusStore.get.textDirection(),
		debug.debug
	);

	const annotationGroups = first.map(g => ({
		groupname: g.label!,
		options: g.entries.map<QueryBuilderAttributeDef>((annot, i) => ({
			attribute: annot.id,
			caseSensitive: annot.caseSensitive,
			label: (g.options[i] as Option).label!,
			textDirection: CorpusStore.get.textDirection(),
			values: annot.values
		}))
	}));

	const withinOptions = UIStore.getState().search.shared.within.elements;

	// Initialize configuration
	const queryBuilderElements = $('.querybuilder');
	const queryBuilders: QueryBuilder[] = [];
	for (let i = 0; i < queryBuilderElements.length; i++) {
		const el = queryBuilderElements[i];
		queryBuilders.push(await initQueryBuilder(el, i)); // see below
	}
	debugLog('Finished initializing querybuilder');
	return queryBuilders;

	async function initQueryBuilder(el: HTMLElement, i: number): Promise<QueryBuilder> {
		if (el.classList.contains('bl-querybuilder-root'))
			return $(el).data('builder'); // already initialized

		const instance = new QueryBuilder($(el), {
			queryBuilder: {
				view: {
					withinSelectOptions: withinOptions
				}
			},
			attribute: {
				view: {
					// Pass the available properties of tokens in this corpus (PoS, Lemma, Word, etc..) to the querybuilder
					attributes: annotationGroups.length > 1 ? annotationGroups : annotationGroups.flatMap(g => g.options),
					defaultAttribute: UIStore.getState().search.advanced.defaultSearchAnnotationId
				}
			}
		});

		if (i == 0) {
			// SOURCE

			// Set initial value
			let lastPattern: string|null = null;
			if (PatternStore.getState().advanced.query == null) {
				// not initialized in store, set to default from querybuilder
				lastPattern = instance.getCql();
				PatternStore.actions.advanced.query(lastPattern);
			} else {
				// already something in store - copy to querybuilder.
				lastPattern = PatternStore.getState().advanced.query;
				const success = await instance.parse(lastPattern);
				if (!success) {
					// Apparently it's invalid? reset to default.
					PatternStore.actions.advanced.query(instance.getCql());
				}
			}

			// Enable two-way binding.
			RootStore.store.watch(state => state.patterns.advanced.query, v => {
				if (v !== lastPattern) {
					lastPattern = v;
					instance.parse(v);
				}
			});
			instance.element.on('cql:modified', () => {
				const pattern = instance.getCql();
				lastPattern = pattern;
				PatternStore.actions.advanced.query(pattern);
			});
		} else {
			// TARGET
			const targetIndex = i - 1;

			// Set initial value
			let lastPattern: string|null = null;
			if (PatternStore.getState().advanced.targetQueries[targetIndex] == null) {
				// not initialized in store, set to default from querybuilder
				lastPattern = instance.getCql();
				PatternStore.actions.advanced.changeTargetQuery({ index: targetIndex, value: lastPattern || '' });
			} else {
				// already something in store - copy to querybuilder.
				lastPattern = PatternStore.getState().advanced.targetQueries[targetIndex];
				const success = await instance.parse(lastPattern);
				if (!success) {
					// Apparently it's invalid? reset to default.
					PatternStore.actions.advanced.changeTargetQuery({ index: targetIndex, value: instance.getCql() || '' });
				}
			}

			// Enable two-way binding.
			RootStore.store.watch(state => state.patterns.advanced.targetQueries[targetIndex], v => {
				if (v !== lastPattern) {
					lastPattern = v;
					instance.parse(v);
				}
			});
			instance.element.on('cql:modified', () => {
				const pattern = instance.getCql();
				lastPattern = pattern;
				PatternStore.actions.advanced.changeTargetQuery({ index: targetIndex, value: pattern || '' });
			});

		}

		return instance;
	}
}

