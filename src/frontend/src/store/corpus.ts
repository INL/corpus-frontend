/**
 * This store module contains all global parameters that instantly update the displayed results
 * Think things like page size, context size, random sampling settings
 */

import {getStoreBuilder} from 'vuex-typex';

import {RootState} from '@/store';
import * as BLTypes from '@/types/blacklabtypes';

export type ModuleRootState = BLTypes.BLIndexMetadata;

declare var SINGLEPAGE: {INDEX: BLTypes.BLIndexMetadata;};
const b = getStoreBuilder<RootState>().module<ModuleRootState>('index', SINGLEPAGE.INDEX);

export const get = {
	annotatedFields: b.read(state => {
		const fields = Object.values(state.annotatedFields);
		const annotations = fields.flatMap(field => {
			const extendedAnnotations = Object.entries(field.annotations).map(([id, annot]) => ({...annot, id}));
			return extendedAnnotations;
		});

		return annotations;
	}, 'annotatedFields'),
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
	}, 'metadataGroups')
};

export const actions = {
	// nothing here yet (probably never, indexmetadata should be considered immutable)
};

export const getState = b.state();

/** We need to call some function from the module before creating the root store or this code won't have run */
export default () => {/**/};
