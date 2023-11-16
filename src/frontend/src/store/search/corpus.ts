/**
 * This module contains the corpus info as it's configured in blacklab.
 * We use it for pretty much everything to do with layout:
 * which annotations and filters are available, what is the default annotation (lemma/pos/word/etc...),
 * are the filters subdivided in groups, what is the text direction, and so on.
 */

import {getStoreBuilder} from 'vuex-typex';
import cloneDeep from 'clone-deep';

import * as Api from '@/api';

import {RootState} from '@/store/search/';

import {normalizeIndex} from '@/utils/blacklabutils';

import {NormalizedIndex, NormalizedAnnotation, NormalizedMetadataField, NormalizedAnnotatedField, NormalizedMetadataGroup, NormalizedAnnotationGroup} from '@/types/apptypes';
import { MapOf, mapReduce } from '@/utils';

type ModuleRootState = {
	state: 'loading'|'error'|'loaded'|'requiresLogin'|'unauthorized';
	message: string;
	corpus: NormalizedIndex|null;
};

const namespace = 'corpus';
const b = getStoreBuilder<RootState>().module<ModuleRootState>(namespace, {corpus: null, state: 'loading', message: ''});

const getState = b.state();

const get = {
	/** All annotations, without duplicates and in no specific order */
	allAnnotations: b.read((state): NormalizedAnnotation[] => Object.values(state.corpus?.annotatedFields ?? {}).flatMap(f => Object.values(f.annotations)), 'allAnnotations'),
	allAnnotationsMap: b.read((state): MapOf<NormalizedAnnotation> => mapReduce(get.allAnnotations(), 'id'), 'allAnnotationsMap'),

	allMetadataFields: b.read((state): NormalizedMetadataField[] => Object.values(state.corpus?.metadataFields || {}), 'allMetadataFields'),
	allMetadataFieldsMap: b.read((state): MapOf<NormalizedMetadataField> => state.corpus?.metadataFields ?? {}, 'allMetadataFieldsMap'),

	// TODO might be collisions between multiple annotatedFields, this is an unfinished part in blacklab
	// like for instance, in a BLHitSnippet, how do we know which of the props comes from which annotatedfield.
	/** Get all annotation displayNames, including for internal annotations */
	annotationDisplayNames: b.read((state): MapOf<string> => mapReduce(get.allAnnotations(), 'id', a => a.displayName), 'annotationDisplayNames'),

	// TODO there can be multiple main annotations if there are multiple annotatedFields
	// the ui needs to respect this (probably render more extensive results?)
	firstMainAnnotation: () => get.allAnnotations().find(f => f.isMainAnnotation)!,

	/**
	 * Returns all metadatagroups from the indexstructure, unless there are no metadatagroups defined.
	 * In that case a single generated group "metadata" is returned, containing all metadata fields.
	 * If groups are defined, fields not in any group are omitted.
	 */
	metadataGroups: b.read((state): Array<NormalizedMetadataGroup&{fields: NormalizedMetadataField[]}> => state.corpus?.metadataFieldGroups.map(g => ({
		...g,
		fields: g.entries.map(id => state.corpus!.metadataFields[id])
	})) ?? [], 'metadataGroups'),

	/**
	 * Returns all annotationGroups from the indexstructure.
	 * May contain internal annotations if groups were defined through indexconfig.yaml.
	 */
	annotationGroups: b.read((state): Array<NormalizedAnnotationGroup&{fields: NormalizedAnnotation[]}> => state.corpus?.annotationGroups.map(g => ({
		...g,
		fields: g.entries.map(id => state.corpus!.annotatedFields[g.annotatedFieldId].annotations[id]),
	})) ?? [], 'annotationGroups'),

	textDirection: b.read(state => state.corpus?.textDirection ?? 'ltr', 'getTextDirection')
};

const actions = {
	// TODO should this just be a part of search.xml? It's such a fundamental part of the page setup.
	loadTagsetValues: b.commit((state, handler: (state: ModuleRootState) => void) => {
		handler(state);
	}, 'loadTagsetValues')
	// nothing here yet (probably never, indexmetadata should be considered immutable)
	// maybe just some things to customize displaynames and the like.
};

const privateActions = {
	setCorpus: b.commit((state, newState: ModuleRootState) => Object.assign(state, newState), 'setCorpus'),
}

/** Expects the blacklab api to be initialized. */
const init = () => {
	Api.blacklab
	.getCorpus(INDEX_ID)
	.then(corpus => {
		// We to finish up some state that might be missing.
		if (corpus.documentCount === -1) {
			// Request a sum of all documents in the corpus
			Api.blacklab.getDocs(corpus.id, {
				first: 0,
				number: 0,
				waitfortotal: true
			})
			.request.then(r => {
				corpus.documentCount = r.summary.numberOfDocs;
			});
		}

		// Filter bogus entries from groups (normally doesn't happen, but might happen when customjs interferes with the page).
		corpus.annotationGroups.forEach(g => g.entries = g.entries.filter(id => corpus.annotatedFields[g.annotatedFieldId].annotations[id]));
		corpus.metadataFieldGroups.forEach(g => g.entries = g.entries.filter(id => corpus.metadataFields[id]));

		privateActions.setCorpus({state: 'loaded', message: '', corpus});
	})
	.catch((e: Api.ApiError) => {
		if (e.httpCode === 401) {
			privateActions.setCorpus({state: 'requiresLogin', message: e.message, corpus: null});
		} else if (e.httpCode === 403) {
			privateActions.setCorpus({state: 'unauthorized', message: e.message, corpus: null});
		} else {
			privateActions.setCorpus({state: 'error', message: e.message, corpus: null})
		}
	});
}





export {
	ModuleRootState,
	NormalizedIndex,
	NormalizedAnnotatedField,
	NormalizedAnnotation,
	NormalizedMetadataField,

	getState,
	get,
	actions,
	init,

	namespace,
};
