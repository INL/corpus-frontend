import {getStoreBuilder} from 'vuex-typex';

import * as Api from '@/api';

import {RootState} from '@/store';

import {normalizeIndex} from '@/utils/blacklabutils';

import * as BLTypes from '@/types/blacklabtypes';
import {NormalizedIndex, NormalizedAnnotation, NormalizedMetadataField, NormalizedAnnotatedField} from '@/types/apptypes';

// TODO initialization order is messy.
declare const SINGLEPAGE: { INDEX: BLTypes.BLIndexMetadata; };
declare const PROPS_IN_COLUMNS: string[];

type ModuleRootState = NormalizedIndex;

const b = getStoreBuilder<RootState>().module<ModuleRootState>('corpus', normalizeIndex(JSON.parse(JSON.stringify(SINGLEPAGE.INDEX))));

const getState = b.state();

const get = {
	annotations: b.read(state =>
		Object.values(state.annotatedFields)
		.flatMap(f => Object.values(f.annotations))
		.filter(a => !a.isInternal && a.hasForwardIndex)
	, 'annotations'),

	// TODO might be collisions between multiple annotatedFields, this is an unfinished part in blacklab
	// like for instance, in a BLHitSnippet, how do we know which of the props comes from which annotatedfield.
	annotationDisplayNames: b.read(state =>
		Object.values(state.annotatedFields)
		.flatMap(f => Object.values(f.annotations))
		.reduce<{[id: string]: string; }>((acc, v) => {
			acc[v.id] = v.displayName;
			return acc;
		}, {}), 'annotationDisplayNames'),

	// TODO there can be multiple main annotations if there are multiple annotatedFields
	// the ui needs to respect this (probably render more extensive results?)
	firstMainAnnotation: () => get.annotations().find(f => f.isMainAnnotation)!,
	/**
	 * Shown result columns can be configured, these are the annotations that should be shown in order of declaration.
	 * Duplicates may exist in this list!
	 */
	shownAnnotations: () => {
		const annotations = get.annotations();
		return PROPS_IN_COLUMNS.map(annotId => annotations.find(annot => annot.id === annotId))
			.filter(annot => annot != null) as typeof annotations; // need cast to remove union with undefined from .find()
	},

	/**
	 * Returns all metadatagroups from the indexstructure, unless there are no metadatagroups defined
	 * Then a single generated group "metadata" is returned, containing all metadata fields.
	 * If groups are defined, fields not in a group are omitted
	 */
	metadataGroups: b.read((state): Array<{
		name: string,
		fields: NormalizedMetadataField[]
	}> => {
		return state.metadataFieldGroups.map(g => {
			return {
				...g,
				fields: g.fields.map(fieldId => state.metadataFields[fieldId]).filter(f => f != null)
			};
		});
	}, 'metadataGroups'),

	annotationGroups: b.read((state): Array<{
		name: string;
		annotatedFieldId: string;
		annotations: NormalizedAnnotation[]
	}> => {
		return state.annotationGroups.map(g => ({
			...g,
			annotations: g.annotationIds.map(id => state.annotatedFields[g.annotatedFieldId].annotations[id])
		}));
	}, 'annotationGroups'),

	textDirection: b.read(state => state.textDirection, 'getTextDirection')
};

const actions = {
	// nothing here yet (probably never, indexmetadata should be considered immutable)
};

const init = () => {
	const state = getState();
	if (state.documentCount === -1) {
		// Request a sum of all documents in the corpus
		Api.blacklab.getDocs(state.id, {
			first: 0,
			number: 0,
			waitfortotal: true
		})
		.request.then(r => {
			state.documentCount = r.summary.numberOfDocs;
		});
	}
};

export {
	ModuleRootState,

	getState,
	get,
	actions,
	init,

	NormalizedIndex,
	NormalizedAnnotatedField,
	NormalizedAnnotation,
	NormalizedMetadataField
};
