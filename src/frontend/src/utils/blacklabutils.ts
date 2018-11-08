import {NormalizedIndex, NormalizedAnnotation, NormalizedAnnotatedField, NormalizedMetadataField, NormalizedIndexOld, NormalizedFormatOld} from '@/types/apptypes';
import * as BLTypes from '@/types/blacklabtypes';

export function normalizeIndex(blIndex: BLTypes.BLIndexMetadata): NormalizedIndex {
	function findAnnotationGroup(annotatedFieldId: string, annotationId: string): string|undefined {
		const groupsForAnnotatedField = blIndex.annotationGroups[annotatedFieldId];
		if (groupsForAnnotatedField == null) {
			return undefined;
		}

		const group = groupsForAnnotatedField.find(g => g.annotations.includes(annotationId));
		return group ? group.name : undefined;
	}

	function findMetadataGroup(field: BLTypes.BLMetadataField): string|undefined {
		const group = blIndex.metadataFieldGroups.find(g => g.fields.includes(field.fieldName));
		return group != null ? group.name : undefined;
	}

	function normalizeAnnotationUIType(field: BLTypes.BLAnnotation): NormalizedAnnotation['uiType'] {
		if (!field.uiType) {
			return field.values ? field.valueListComplete ? 'select' : 'combobox' : 'text';
		}

		switch (field.uiType) {
			case 'select': return field.values && field.valueListComplete ? 'select' : 'combobox';
			case 'combobox': return 'combobox';
			default: return 'text';
		}
	}

	function normalizeMetadataUIType(field: BLTypes.BLMetadataField): NormalizedMetadataField['uiType'] {
		if (!field.uiType) {
			return Object.keys(field.fieldValues).length > 0 ? field.valueListComplete ? 'select' : 'combobox' : 'text';
		}

		switch (field.uiType) {
			case 'select': return field.valueListComplete ? 'select' : 'combobox';
			case 'combobox':
			case 'range':
				return field.uiType;
			case 'checkbox':
			case 'radio':
				return field.valueListComplete ? field.uiType : 'combobox';
			default: return 'text';
		}
	}

	function normalizeAnnotation(annotatedFieldId: string, mainAnnotationId: string, annotationId: string, annotation: BLTypes.BLAnnotation): NormalizedAnnotation{
		return {
			annotatedFieldId,
			caseSensitive: annotation.sensitivity === 'SENSITIVE_AND_INSENSITIVE',
			description: annotation.description,
			displayName: annotation.displayName || annotationId,
			groupId: findAnnotationGroup(annotatedFieldId, annotationId),
			hasForwardIndex: annotation.hasForwardIndex,
			id: annotationId,
			isInternal: annotation.isInternal,
			isMainAnnotation: annotationId === mainAnnotationId,
			offsetsAlternative: annotation.offsetsAlternative,
			uiType: normalizeAnnotationUIType(annotation),
			values: normalizeAnnotationUIType(annotation) === 'select' ? annotation.values!.map(v => ({label: v, value: v})) : undefined,
		};
	}

	function normalizeMetadata(field: BLTypes.BLMetadataField): NormalizedMetadataField {
		return {
			description: field.description,
			displayName: field.displayName || field.fieldName,
			groupId: findMetadataGroup(field),
			id: field.fieldName,
			uiType: normalizeMetadataUIType(field),
			values: ['select', 'checkbox', 'radio'].includes(normalizeMetadataUIType(field)) ? Object.keys(field.fieldValues).map(value => {
				return {
					value,
					label: field.displayValues[value] != null ? field.displayValues[value] : value
				};
			}) : undefined,
		};
	}

	const annotatedFields: BLTypes.BLAnnotatedField[] = BLTypes.isIndexMetadataV1(blIndex) ? Object.values(blIndex.complexFields) : Object.values(blIndex.annotatedFields);

	return {
		annotatedFields:
			annotatedFields.map<NormalizedAnnotatedField>(f => {
				const annotations: Array<[string, BLTypes.BLAnnotation]> = BLTypes.isAnnotatedFieldV1(f) ? Object.entries(f.properties) : Object.entries(f.annotations);

				return {
					annotations:
						annotations.map(([annotationId, annotation]) => normalizeAnnotation(f.fieldName, f.mainProperty, annotationId, annotation))
						.reduce<NormalizedAnnotatedField['annotations']>((acc, annot) => {
							acc[annot.id] = annot;
							return acc;
						}, {}),
					description: f.description,
					displayName: f.displayName,
					hasContentStore: f.hasContentStore,
					hasLengthTokens: f.hasLengthTokens,
					hasXmlTags: f.hasXmlTags,
					id: f.fieldName,
					isAnnotatedField: f.isAnnotatedField,
					mainAnnotationId: f.mainProperty,
				};
			})
			.reduce<{[id: string]: NormalizedAnnotatedField}>((acc, field) => {
				acc[field.id] = field;
				return acc;
			}, {}),

		annotationGroups: Object.entries(blIndex.annotationGroups).length > 0 ?
			Object.entries(blIndex.annotationGroups)
			.flatMap<NormalizedIndex['annotationGroups'][number]>(([annotatedFieldId, groups]) =>
				groups.map(group => ({
					annotatedFieldId,
					annotationIds: group.annotations,
					name: group.name,
				}))
			) :
			annotatedFields.map<NormalizedIndex['annotationGroups'][number]>(field => {
				// Add all known annotations to a default group
				// (excluding internals and annotations not in a forward index)
				const annotations = BLTypes.isAnnotatedFieldV1(field) ? field.properties : field.annotations;
				const annotIds = Object.entries(annotations).filter(([id, annot]) => annot.hasForwardIndex && !annot.isInternal).map(([id, annot]) => id);

				return {
					annotatedFieldId: field.fieldName,
					annotationIds: annotIds,
					name: 'Annotations'
				};
			}),

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
		metadataFieldGroups: blIndex.metadataFieldGroups.length > 0 ?
			blIndex.metadataFieldGroups :
			[{
				name: 'Metadata',
				fields: Object.keys(blIndex.metadataFields)
			}],

		metadataFields:
			Object.values(blIndex.metadataFields)
			.map(normalizeMetadata)
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

// TODO this function is broken? key and value have inferred type any, verify what is going on here.
// seems like type should be [key: string]: BLTypes.BLFormat instead of BLFormats
// export function normalizeFormatsOld(formats: {[key: string]: BLTypes.BLFormats}): NormalizedFormatOld[] {
// 	return Object.entries(formats.supportedInputFormats)
// 	.map(([key, value]) => normalizeFormatOld(key, value));
// }
