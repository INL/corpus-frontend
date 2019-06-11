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

declare const SINGLEPAGE: { INDEX: BLTypes.BLIndexMetadata; };

type ModuleRootState = NormalizedIndex;

const namespace = 'corpus';
const b = getStoreBuilder<RootState>().module<ModuleRootState>(namespace, normalizeIndex(cloneDeep(SINGLEPAGE.INDEX)));

const getState = b.state();

const get = {
	/*
	TODO order of returned annotations is not entirely correct, as annotations can have an order defined in two ways:
	- through the order of the id array in an annotatedFieldGroup
	- through the displayOrder array in the parent annotatedField
	right now we're always using the displayOrder from the annotatedField, but the order of the annotatedFieldGroup should actually have a higher prio!
	we can't just get the fields from the annotatedFieldGroup(s), because they may not contain all annotations (an annotation not in any group is simply not shown)

	This is a really minor issue though...
	the case can be made that it's not important to use the fieldgroup's orders anyway,
	because we're not doing anything with those groups if we need all annotations
	*/
	annotations: b.read(state =>
		Object.values(state.annotatedFields)
		.flatMap(f => f.displayOrder.map(id => f.annotations[id]))
		.filter(a => !a.isInternal)
	, 'annotations'),
	annotationsMap: b.read((state): {[id: string]: NormalizedAnnotation[]} =>
		get.annotations()
		.reduce<{[id: string]: NormalizedAnnotation[]}>((fields, field) => {
			if (!fields[field.id]) {
				fields[field.id] = [];
			}
			fields[field.id].push(field);
			return fields;
		}, {})
		// return annotations;
	, 'annotationsMap'),

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
	 * Returns all metadatagroups from the indexstructure, unless there are no metadatagroups defined.
	 * In that case a single generated group "metadata" is returned, containing all metadata fields.
	 * If groups are defined, fields not in any group are omitted.
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
			// use group's annotation order! not the parent annotatedField's displayOrder
			annotations: g.annotationIds.map(id => state.annotatedFields[g.annotatedFieldId].annotations[id]).filter(annot => !annot.isInternal)
		}));
	}, 'annotationGroups'),

	textDirection: b.read(state => state.textDirection, 'getTextDirection')
};

const actions = {
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
