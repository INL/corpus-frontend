/**
 * This store module contains all global parameters that instantly update the displayed results
 * Think things like page size, context size, random sampling settings
 */

import {getStoreBuilder} from 'vuex-typex';

import {RootState} from '@/store';
import * as BLTypes from '@/types/blacklabtypes';

export type ModuleRootState = BLTypes.BLIndexMetadata;

declare const SINGLEPAGE: {INDEX: BLTypes.BLIndexMetadata;};
declare const PROPS_IN_COLUMNS: string[];
const b = getStoreBuilder<RootState>().module<ModuleRootState>('corpus', SINGLEPAGE.INDEX);

export const get = {
	annotations: b.read(state => {
		const fields = Object.values(state.annotatedFields);
		const annotations = fields.flatMap(field => {
			const extendedAnnotations = Object.entries(field.annotations).map(([id, annot]) => ({
				...annot,
				id,
				isMainAnnotation: id === field.mainProperty
			}));
			return extendedAnnotations;
		});

		return annotations;
	}, 'annotatedFields'),
	// TODO there can be multiple main annotations if there are multiple annotatedFields
	// the ui needs to respect this (probably render more extensive results?)
	firstMainAnnotation: () => get.annotations().find(f => f.isMainAnnotation)!,
	/**
	 * Shown result columns can be configured, these are the annotations that should be shown in order of declaration.
	 * Duplicates may exist in this list!
	 */
	shownAnnotations: () => {
		const annotations = get.annotations();
		return PROPS_IN_COLUMNS.map(propId => annotations.find(annot => annot.id === propId))
			.filter(annot => annot != null) as typeof annotations; // need cast to remove union with undefined from .find()
	},

	/**
	 * Returns all metadatagroups from the indexstructure, unless there are no metadatagroups defined
	 * Then a single generated group "metadata" is returned, containing all metadata fields.
	 * If groups are defined, fields not in a group are omitted
	 */
	metadataGroups: b.read((state): Array<{name: string, fields: BLTypes.BLMetadataField[]}> => {
		/*
		if there are no fields defined, return all of the metadatafields in a synthetic "metadata" group
		if there are fields defined, return them as is with the fields substituted
		*/
		if (!state.metadataFieldGroups.length) {
			return [{
				name: 'metadata',
				fields: Object.values(state.metadataFields)
			}];
		}
		return state.metadataFieldGroups.map(group => ({
			name: group.name,
			fields: group.fields.map(fieldname => state.metadataFields[fieldname])
		}));
	}, 'metadataGroups'),
	textDirection: b.read(state => state.textDirection, 'getTextDirection')
};

export const actions = {
	// nothing here yet (probably never, indexmetadata should be considered immutable)
};

export const getState = b.state();

/** We need to call some function from the module before creating the root store or this code won't have run */
export default () => {/**/};
