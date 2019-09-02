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

import * as BLTypes from '@/types/blacklabtypes';
import {NormalizedIndex, NormalizedAnnotation, NormalizedMetadataField, NormalizedAnnotatedField} from '@/types/apptypes';
import { MapOf, multimapReduce, makeMapReducer, mapReduce } from '@/utils';

declare const SINGLEPAGE: { INDEX: BLTypes.BLIndexMetadata; };

type ModuleRootState = NormalizedIndex;

const namespace = 'corpus';
const b = getStoreBuilder<RootState>().module<ModuleRootState>(namespace, normalizeIndex(cloneDeep(SINGLEPAGE.INDEX)));

const getState = b.state();

const get = {
	/** Get all annotations in display groups. May include internal annotations. Only has internal annotations when defined through yaml. Sorted by display order. */
	shownAnnotations: b.read((state): NormalizedAnnotation[] =>
		Object.values(state.annotationGroups).flatMap(g => g.annotationIds.map(id => state.annotatedFields[g.annotatedFieldId].annotations[id]))
	, 'annotations'),
	/** Get all annotations in display groups. May include internal annotations. Only has internal annotations when defined through yaml. */
	shownAnnotationsMap: b.read((state): MapOf<NormalizedAnnotation[]> => multimapReduce(get.shownAnnotations(), 'id'), 'annotationsMap'),

	/** Get all annotations, sorted by displayOrder. Annotations not in a group are at the end of the array. */
	allAnnotations: b.read((state): NormalizedAnnotation[] =>
		get.shownAnnotations() // first list all annotations in groups
		.concat( // then append all annotations not in any group
			Object.values(state.annotatedFields)
			.flatMap(f =>
				f.displayOrder
				.map(id => f.annotations[id])
				.filter(annot => annot.groupId == null)
			)
		)
	, 'allAnnotations'),
	/** Get all annotations. */
	allAnnotationsMap: b.read((state): {[id: string]: NormalizedAnnotation[]} => multimapReduce(get.allAnnotations(), 'id'), 'allAnnotationsMap'),

	/** Get all metadata fields in display groups. Sorted by display order. */
	shownMetadataFields: b.read((state): NormalizedMetadataField[] => state.metadataFieldGroups.flatMap(g => g.fields).map(id => state.metadataFields[id]), 'shownMetadataFields'),
	/** Get all metadata fields in display groups. */
	shownMetadataFieldsMap: b.read((state): MapOf<NormalizedMetadataField> => mapReduce(get.shownMetadataFields(), 'id'), 'shownMetadataFieldsMap'),

	/** Get all metadata fields in the index. Sorted by display order. Fields not in a group are at the end of the array. */
	allMetadataFields: b.read((state): NormalizedMetadataField[] =>
		get.shownMetadataFields()
		.concat(
			Object.values(state.metadataFields)
			.filter(f => f.groupId == null)
			.sort((a, b) => a.displayName.localeCompare(b.displayName))
		)
	, 'allMetadataFields'),
	/** Get all metadata fields in the index. */
	allMetadataFieldsMap: b.read((state): MapOf<NormalizedMetadataField> => mapReduce(get.allMetadataFields(), 'id'), 'allMetadataFieldsMap'),

	// TODO might be collisions between multiple annotatedFields, this is an unfinished part in blacklab
	// like for instance, in a BLHitSnippet, how do we know which of the props comes from which annotatedfield.
	/** Get all annotation displayNames, including for internal annotations */
	annotationDisplayNames: b.read<MapOf<string>>(state =>
		Object.values(state.annotatedFields)
		.flatMap(f => Object.values(f.annotations))
		.reduce(makeMapReducer('id', annot => annot.displayName), {})
	, 'annotationDisplayNames'),

	// TODO there can be multiple main annotations if there are multiple annotatedFields
	// the ui needs to respect this (probably render more extensive results?)
	firstMainAnnotation: () => get.allAnnotations().find(f => f.isMainAnnotation)!,

	/**
	 * Returns all metadatagroups from the indexstructure, unless there are no metadatagroups defined.
	 * In that case a single generated group "metadata" is returned, containing all metadata fields.
	 * If groups are defined, fields not in any group are omitted.
	 */
	metadataGroups: b.read((state) => {
		return state.metadataFieldGroups.map(g => {
			return {
				name: g.name,
				fieldIds: g.fields,
				fields: g.fields.map(fieldId => state.metadataFields[fieldId]).filter(f => f != null)
			};
		});
	}, 'metadataGroups'),

	/**
	 * Returns all annotationGroups from the indexstructure.
	 * May contain internal annotations if groups were defined through indexconfig.yaml.
	 */
	annotationGroups: b.read((state): Array<{
		name: string;
		annotatedFieldId: string;
		annotations: NormalizedAnnotation[]
	}> => {
		return state.annotationGroups.map(g => ({
			...g,
			// use group's annotation order! not the parent annotatedField's displayOrder
			annotations: g.annotationIds.map(id => state.annotatedFields[g.annotatedFieldId].annotations[id])
		}));
	}, 'annotationGroups'),

	textDirection: b.read(state => state.textDirection, 'getTextDirection')
};

const actions = {
	loadTagsetValues: b.commit((state, handler: (state: ModuleRootState) => void) => {
		handler(state);
	}, 'loadTagsetValues')
	// nothing here yet (probably never, indexmetadata should be considered immutable)
	// maybe just some things to customize displaynames and the like.
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
