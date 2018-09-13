/**
 * This store module contains all global parameters that instantly update the displayed results
 * Think things like page size, context size, random sampling settings
 */

import {StoreBuilder, ModuleBuilder} from 'vuex-typex';

import {RootState} from '@/store';
import * as BLTypes from '@/types/blacklabtypes';

declare var SINGLEPAGE: {INDEX: BLTypes.BLIndexMetadata;};

export type ModuleRootState = BLTypes.BLIndexMetadata;

const createGetters = (b: ModuleBuilder<ModuleRootState, RootState>) => {
	const get = {
		annotatedFields: b.read(state => {
			const fields = Object.values(state.annotatedFields);
			const annotations = fields.flatMap(field => {
				const extendedAnnotations = Object.entries(field.annotations).map(([id, annot]) => ({...annot, id}));
				return extendedAnnotations;
			});

			return annotations;
		}, 'annotatedFields'),
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
	return get;
};

export const create = <M> (parent: StoreBuilder<RootState>|ModuleBuilder<M, RootState>, namespace: string) => {
	const b = parent.module<ModuleRootState>(namespace, SINGLEPAGE.INDEX);
	return {
		actions: {},
		get: createGetters(b),
		namespace
	};
};
