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
export async function initQueryBuilders(i18n: Vue): Promise<QueryBuilder[]> {
	debugLog('Begin initializing querybuilder(s)');

	const first = getAnnotationSubset(
		UIStore.getState().search.advanced.searchAnnotationIds,
		CorpusStore.get.annotationGroups(),
		CorpusStore.get.allAnnotationsMap(),
		'Search',
		i18n,
		CorpusStore.get.textDirection(),
		false,
		false
	);

	const annotationGroups = first.map(g => ({
		groupname: g.label!,
		options: (g.options as Option[]).map<QueryBuilderAttributeDef>(({value: annotationId, label: localizedAnnotationDisplayName, title: localizedAnnotationDescription}, i) => ({
			attribute: annotationId,
			caseSensitive: g.entries[i].caseSensitive,
			label: (localizedAnnotationDisplayName || annotationId) + (debug.debug ? ` [id: ${annotationId}]` : ''),
			textDirection: CorpusStore.get.textDirection(),
			values: g.entries[i].values
		}))
	}));

	const withinSelectOptions = UIStore.getState().search.shared.within.elements
			.filter(UIStore.corpusCustomizations.search.within.include)
			.map(opt => ({
				...opt,
				label: i18n.$tWithinDisplayName(opt) || 'document',
			}));

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
		// Re-init settings due to potentially changed translations in the options
		const settings = {
			queryBuilder: {
				view: {
					withinSelectOptions
				}
			},
			attribute: {
				view: {
					// Pass the available properties of tokens in this corpus (PoS, Lemma, Word, etc..) to the querybuilder
					attributes: annotationGroups.length > 1 ? annotationGroups : annotationGroups.flatMap(g => g.options),
					defaultAttribute: UIStore.getState().search.advanced.defaultSearchAnnotationId
				}
			}
		};

		// Set initial value
		let lastPattern: string|null = null;

		if (el.classList.contains('bl-querybuilder-root')) {
			const existing = $(el).data('builder') as QueryBuilder;
			existing.refresh(settings);
			existing.element.on('cql:modified', () => {
				const pattern = instance.getCql();
				lastPattern = pattern;
				PatternStore.actions.advanced.query(pattern);
			});
			return existing;
		}

		const instance = new QueryBuilder($(el), settings, i18n);

		if (i == 0) {
			// SOURCE

			// Set initial value
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

