import {NormalizedIndex, NormalizedAnnotation, NormalizedAnnotatedField, NormalizedMetadataField, NormalizedIndexOld, NormalizedFormatOld} from '@/types/apptypes';
import * as BLTypes from '@/types/blacklabtypes';
import { mapReduce, makeMapReducer } from '@/utils';

function findAnnotationGroup(annotatedFieldId: string, annotationId: string, groups: NormalizedIndex['annotationGroups']): string|undefined {
	const groupsForAnnotatedField = groups.filter(g => g.annotatedFieldId === annotatedFieldId);
	const group = groupsForAnnotatedField.find(g => g.annotationIds.includes(annotationId));
	return group ? group.name : undefined;
}

function findMetadataGroup(field: BLTypes.BLMetadataField, groups: BLTypes.BLIndexMetadata['metadataFieldGroups']): string|undefined {
	const group = groups.find(g => g.fields.includes(field.fieldName));
	return group != null ? group.name : undefined;
}

/** Find the annotation that contains annotationId as on of its subAnnotations. */
function findParentAnnotation(annotatedField: BLTypes.BLAnnotatedField, annotationId: string): string|undefined {
	const annotations = BLTypes.isAnnotatedFieldV1(annotatedField) ? Object.entries(annotatedField.properties) : Object.entries(annotatedField.annotations);
	const parent: [string, BLTypes.BLAnnotation]|undefined = annotations.find(a => a[1].subannotations ? a[1].subannotations!.includes(annotationId) : false);
	return parent ? parent[0] : undefined;
}

function normalizeMetadataUIType(field: BLTypes.BLMetadataField): NormalizedMetadataField['uiType'] {
	const uiType = field.uiType.trim().toLowerCase();

	if (!uiType) {
		return Object.keys(field.fieldValues).length > 0 ? field.valueListComplete ? 'select' : 'combobox' : 'text';
	}

	switch (uiType) {
		case 'combobox':
		case 'range':
			return uiType;
		case 'select':
		case 'checkbox':
		case 'radio':
			return field.valueListComplete ? uiType : 'combobox';
		default: return 'text';
	}
}

function normalizeAnnotationUIType(field: BLTypes.BLAnnotation): NormalizedAnnotation['uiType'] {
	const uiType = field.uiType.trim().toLowerCase();

	if (!uiType) {
		return field.values ? field.valueListComplete ? 'select' : 'combobox' : 'text';
	}

	switch (uiType) {
		case 'select': return field.values && field.valueListComplete ? 'select' : 'combobox';
		case 'combobox':
		case 'pos':
			return uiType;
		default: return 'text';
	}
}

function normalizeAnnotation(annotatedField: BLTypes.BLAnnotatedField, annotationId: string, annotation: BLTypes.BLAnnotation, groups: NormalizedIndex['annotationGroups']): NormalizedAnnotation{
	const annotatedFieldId = annotatedField.fieldName;
	const mainAnnotationId = BLTypes.isAnnotatedFieldV1(annotatedField) ? annotatedField.mainProperty : annotatedField.mainAnnotation;

	return {
		annotatedFieldId,
		caseSensitive: annotation.sensitivity === 'SENSITIVE_AND_INSENSITIVE',
		description: annotation.description,
		displayName: annotation.displayName || annotationId,
		groupId: findAnnotationGroup(annotatedFieldId, annotationId, groups),
		hasForwardIndex: annotation.hasForwardIndex,
		id: annotationId,
		isInternal: annotation.isInternal,
		isMainAnnotation: annotationId === mainAnnotationId,
		offsetsAlternative: annotation.offsetsAlternative,
		subAnnotations: annotation.subannotations,
		parentAnnotationId: findParentAnnotation(annotatedField, annotationId),
		uiType: normalizeAnnotationUIType(annotation),
		values: annotation.valueListComplete && annotation.values && annotation.values.length > 0 ? annotation.values.map(v => ({label: v, value: v, title: null})) : undefined,
	};
}

function normalizeMetadata(field: BLTypes.BLMetadataField, groups: BLTypes.BLIndexMetadata['metadataFieldGroups']): NormalizedMetadataField {
	return {
		description: field.description,
		displayName: field.displayName || field.fieldName,
		groupId: findMetadataGroup(field, groups),
		id: field.fieldName,
		uiType: normalizeMetadataUIType(field),
		values: ['select', 'checkbox', 'radio'].includes(normalizeMetadataUIType(field)) ? Object.keys(field.fieldValues).map(value => {
			return {
				value,
				label: field.displayValues[value] != null ? field.displayValues[value] : value,
				title: null
			};
		}) : undefined,
	};
}

// -------------

export function normalizeIndex(blIndex: BLTypes.BLIndexMetadata): NormalizedIndex {

	const annotatedFields: BLTypes.BLAnnotatedField[] = BLTypes.isIndexMetadataV1(blIndex) ? Object.values(blIndex.complexFields) : Object.values(blIndex.annotatedFields);
	let annotationGroupsNormalized: NormalizedIndex['annotationGroups'] = [];
	if (blIndex.annotationGroups) {
		annotationGroupsNormalized = Object.entries(blIndex.annotationGroups).flatMap(([fieldId, groups]) => groups.map(g => ({
			// annotations in a group already have an order to them
			// this should have higher priority than the global order of annotations within this annotatedfield.
			// (which only applies to annotations not defined in a group)
			annotationIds: g.annotations,
			annotatedFieldId: fieldId,
			name: g.name
		})));
	}

	// No groups defined by blacklab.
	// Add all known annotations to a default group
	// (excluding internal annotations)
	if (!annotationGroupsNormalized.length) {
		annotationGroupsNormalized = Object.values(annotatedFields).map(f => BLTypes.isAnnotatedFieldV1(f) ? {
			// this is an old index, displayOrder not supported yet, sort by displayName and remove internal annotations.
			annotationIds:
				Object.keys(f.properties)
				.filter(id => !f.properties[id].isInternal)
				.sort((a, b) => f.properties[a].displayName.localeCompare(f.properties[b].displayName)),
			annotatedFieldId: f.fieldName,
			name: 'Annotations'
		} : {
			// newer index, preserve displayOrder, but remove internal annotations.
			annotationIds: f.displayOrder
				? f.displayOrder
					.filter(id => !f.annotations[id].isInternal)
				: Object.keys(f.annotations)
					.filter(id => !f.annotations[id].isInternal)
					.sort((a, b) => f.annotations[a].displayName.localeCompare(f.annotations[b].displayName)),
			annotatedFieldId: f.fieldName,
			name: 'Annotations'
		});
	}

	const annotatedFieldsNormalized: { [id: string]: NormalizedAnnotatedField; } = annotatedFields.map<NormalizedAnnotatedField>(f => {
		const annotations: Array<[string, BLTypes.BLAnnotation]> = BLTypes.isAnnotatedFieldV1(f) ? Object.entries(f.properties) : Object.entries(f.annotations);
		const mainAnnotationId: string = BLTypes.isAnnotatedFieldV1(f) ? f.mainProperty : f.mainAnnotation;

		return {
			annotations: annotations
				.map(([annotationId, annotation]) => normalizeAnnotation(f, annotationId, annotation, annotationGroupsNormalized))
				.reduce(makeMapReducer('id'), {}),
			description: f.description,
			displayName: f.displayName,
			displayOrder: (!BLTypes.isAnnotatedFieldV1(f) && f.displayOrder != null) ?
				f.displayOrder :
				annotations
				.sort(([aId, a], [bId, b]) => a.displayName.localeCompare(b.displayName)) // sort by displayname if no predefined order
				.map(([id, annot]) => id),
			hasContentStore: f.hasContentStore,
			hasLengthTokens: f.hasLengthTokens,
			hasXmlTags: f.hasXmlTags,
			id: f.fieldName,
			isAnnotatedField: f.isAnnotatedField,
			mainAnnotationId,
		};
	})
	.reduce(makeMapReducer('id'), {});

	const metadataFieldGroupsNormalized =
		blIndex.metadataFieldGroups.length > 0 ? blIndex.metadataFieldGroups :
		[{ name: 'Metadata', fields: Object.keys(blIndex.metadataFields).sort((a, b) => blIndex.metadataFields[a].displayName.localeCompare(blIndex.metadataFields[b].displayName)) }]; // sort by display name

	return {
		annotatedFields: annotatedFieldsNormalized,
		annotationGroups: annotationGroupsNormalized,
		contentViewable: blIndex.contentViewable,
		description: blIndex.description,
		displayName: blIndex.displayName,
		// If BlackLab is an old format, this property doesn't exist
		// If BlackLab is new, and the property is still missing, it's 0 (tokenCount and documentCount are always omitted when 0)
		// Encode this in the fallback value, then later request the actual number of documents
		documentCount: !BLTypes.isIndexMetadataV1(blIndex) ? blIndex.documentCount || 0 : -1,
		documentFormat: blIndex.documentFormat,
		fieldInfo: blIndex.fieldInfo,
		id: blIndex.indexName,
		metadataFieldGroups: metadataFieldGroupsNormalized,
		metadataFields:
			Object.values(blIndex.metadataFields)
			.map(f => normalizeMetadata(f, metadataFieldGroupsNormalized))
			.reduce<NormalizedIndex['metadataFields']>((acc, field) => {
				acc[field.id] = field;
				return acc;
			}, {}),

		owner: blIndex.indexName.substring(0, blIndex.indexName.indexOf(':')) || null,
		shortId: blIndex.indexName.substr(blIndex.indexName.indexOf(':') + 1),
		textDirection: blIndex.textDirection,
		timeModified: blIndex.versionInfo.timeModified,
		tokenCount: blIndex.tokenCount || 0
	};
}

// ----------------------------------------------------------
// Old normalization functions, from corpora management page.
// ----------------------------------------------------------

// TODO merge the old and new NormalizedIndex types

/**
 * Add some calculated properties to the index object (such as if it's a private index) and normalize some optional data to empty strings if missing.
 *
 * @param id full id of the index, including username portion (if applicable)
 * @param index the index json object as received from blacklab-server
 */
export function normalizeIndexOld(id: string, index: BLTypes.BLIndex): NormalizedIndexOld {
	return {
		...index,

		id,
		owner: id.substring(0, id.indexOf(':')) || null,
		shortId: id.substr(id.indexOf(':') + 1),

		displayName: index.displayName || id.substr(id.indexOf(':') + 1),
		documentFormat: index.documentFormat || null,
		indexProgress: index.indexProgress || null,
		tokenCount: index.tokenCount == null ? null : index.tokenCount,
	};
}

/**
 * @param id - full id of the format, including userName portion (if applicable)
 * @param format as received from the server
 */
export function normalizeFormatOld(id: string, format: BLTypes.BLFormat): NormalizedFormatOld {
	return {
		...format,

		id,
		owner: id.substring(0, id.indexOf(':')) || null,
		shortId: id.substr(id.indexOf(':') + 1),

		displayName: format.displayName || id.substr(id.indexOf(':') + 1),
		helpUrl: format.helpUrl || null,
		description: format.description || null,
	};
}

export function normalizeFormatsOld(formats: BLTypes.BLFormats): NormalizedFormatOld[] {
	return Object.entries(formats.supportedInputFormats)
	.map(([key, value]) => normalizeFormatOld(key, value));
}

// ---------------------------------------
// Fixup function for BlackLab 2.0 release
// ---------------------------------------

// tslint:disable
/**
 * Remove at blacklab 2.1 release.
 * Blacklab went from sending document metadata as string to sending as string[].
 * We temporarily bridge this by mapping old responses to also be string[].
 * See api/index.ts
 */
export function fixDocInfo(d: BLTypes.BLDocInfo) {
	for (const key in d) switch (key) {
		case 'lengthInTokens':
		case 'mayView':
			continue;
		default: {
			const v = d[key]
			if (typeof v === 'string') {
				d[key] = [v]
			} else {
				return;
			}
		}
	}
}
// tslint: enable
