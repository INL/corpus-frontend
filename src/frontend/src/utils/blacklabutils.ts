import {NormalizedIndex, NormalizedAnnotation, NormalizedAnnotatedField, NormalizedMetadataField, NormalizedIndexOld, NormalizedFormatOld, NormalizedMetadataGroup, NormalizedAnnotationGroup} from '@/types/apptypes';
import * as BLTypes from '@/types/blacklabtypes';
import { mapReduce } from '@/utils';

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
		case 'autocomplete':
		case 'combobox':
			return 'combobox';
		case 'range':
			return uiType;
		case 'select':
		case 'dropdown':
			return field.valueListComplete ? 'select' : 'combobox';
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
		case 'dropdown':
		case 'select':
			return field.values && field.valueListComplete ? 'select' : 'combobox';
		case 'autocomplete':
		case 'combobox':
			return 'combobox';
		case 'lexicon':
		case 'pos':
			return uiType;
		default: return 'text';
	}
}

function normalizeAnnotation(annotatedField: BLTypes.BLAnnotatedField, annotationId: string, annotation: BLTypes.BLAnnotation): NormalizedAnnotation{
	const annotatedFieldId = annotatedField.fieldName;
	const mainAnnotationId = BLTypes.isAnnotatedFieldV1(annotatedField) ? annotatedField.mainProperty : annotatedField.mainAnnotation;

	return {
		annotatedFieldId,
		caseSensitive: annotation.sensitivity === 'SENSITIVE_AND_INSENSITIVE',
		description: annotation.description,
		displayName: annotation.displayName || annotationId,
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

function normalizeMetadata(field: BLTypes.BLMetadataField): NormalizedMetadataField {
	return {
		description: field.description,
		displayName: field.displayName || field.fieldName,
		id: field.fieldName,
		uiType: normalizeMetadataUIType(field),
		values: ['select', 'checkbox', 'radio'].includes(normalizeMetadataUIType(field)) ? Object.keys(field.fieldValues).map(value => {
			return {
				value,
				label: field.displayValues[value] != null ? field.displayValues[value] : value,
				title: null
			};
		}).sort((a, b) => a.value.localeCompare(b.value)) : undefined,
	};
}

function normalizeAnnotatedField(field: BLTypes.BLAnnotatedField): NormalizedAnnotatedField {
	const annotations: Array<[string, BLTypes.BLAnnotation]> = BLTypes.isAnnotatedFieldV1(field) ? Object.entries(field.properties) : Object.entries(field.annotations);
	const mainAnnotationId: string = BLTypes.isAnnotatedFieldV1(field) ? field.mainProperty : field.mainAnnotation;

	return {
		annotations: mapReduce(annotations.map(([id, annot]) => normalizeAnnotation(field, id, annot)), 'id'),
		description: field.description,
		displayName: field.displayName,
		// displayOrder: Object.keys(annotations).sort((a, b) => annotationDisplayOrder[field.fieldName][a] - annotationDisplayOrder[field.fieldName][b]),
		hasContentStore: field.hasContentStore,
		hasLengthTokens: field.hasLengthTokens,
		hasXmlTags: field.hasXmlTags,
		id: field.fieldName,
		isAnnotatedField: field.isAnnotatedField,
		mainAnnotationId,
	};
}

function normalizeAnnotationGroups(blIndex: BLTypes.BLIndexMetadata): NormalizedAnnotationGroup[] {
	let annotationGroupsNormalized: NormalizedAnnotationGroup[] = [];
	for (const [fieldId, field] of Object.entries(BLTypes.isIndexMetadataV1(blIndex) ? blIndex.complexFields : blIndex.annotatedFields) as Array<[string, BLTypes.BLAnnotatedField]>) {
		const annotations = BLTypes.isAnnotatedFieldV1(field) ? field.properties : field.annotations;
		const idsNotInGroups = new Set(Object.keys(annotations));

		let hasUserDefinedGroup = false;

		// Copy all predefined groups, removing nonexistant annotations and groups
		if (blIndex.annotationGroups && blIndex.annotationGroups[fieldId]) {
			for (const group of blIndex.annotationGroups[fieldId]) {
				const normalizedGroup: NormalizedAnnotationGroup = {
					annotatedFieldId: fieldId,
					id: group.name,
					entries: group.annotations.filter(id => annotations[id] != null),
					isRemainderGroup: false
				};
				if (normalizedGroup.entries.length) {
					annotationGroupsNormalized.push(normalizedGroup);
					normalizedGroup.entries.forEach(id => idsNotInGroups.delete(id));
					hasUserDefinedGroup = true;
				}
			}
		}

		// Add all remaining annotations to the remainder group.
		// First add all explicitly ordered annotations (annotatedField.displayOrder).
		// Finally add everything else at the end, sorted by their displayNames.
		if (idsNotInGroups.size) {
			const remainingAnnotationsToAdd = new Set(idsNotInGroups);
			const idsInRemainderGroup: string[] = [];

			// annotations in displayOrder
			if (!BLTypes.isAnnotatedFieldV1(field) && field.displayOrder) {
				field.displayOrder.forEach(id => {
					if (remainingAnnotationsToAdd.has(id)) {
						remainingAnnotationsToAdd.delete(id);
						idsInRemainderGroup.push(id);
					}
				});
			}
			// Finally all annotations without entry in displayOrder
			idsInRemainderGroup.push(...[...remainingAnnotationsToAdd].sort((a, b) => annotations[a].displayName.localeCompare(annotations[b].displayName)));
			// And create the group.
			annotationGroupsNormalized.push({
				annotatedFieldId: fieldId,
				entries: idsInRemainderGroup,
				id: 'Other',
				// If there was a group defined from the index config, this is indeed the remainder group, otherwise this is just a normal group.
				isRemainderGroup: hasUserDefinedGroup
			});
		}
	}
	return annotationGroupsNormalized;
}

function normalizeMetadataGroups(blIndex: BLTypes.BLIndexMetadata): NormalizedMetadataGroup[] {
	const metadataGroupsNormalized: NormalizedMetadataGroup[] = [];
	const idsNotInGroups = new Set(Object.keys(blIndex.metadataFields));

	let hasUserDefinedGroup = false;

	// Copy predefined groups, removing nonexistant fields and empty groups
	for (const group of blIndex.metadataFieldGroups) {
		const normalizedGroup: NormalizedMetadataGroup = {
			entries: group.fields.filter(id => blIndex.metadataFields[id] != null),
			isRemainderGroup: false,
			id: group.name
		};
		if (normalizedGroup.entries.length) {
			metadataGroupsNormalized.push(normalizedGroup);
			normalizedGroup.entries.forEach(id => idsNotInGroups.delete(id));
			hasUserDefinedGroup = true;
		}
	}

	// Create remainder group
	if(idsNotInGroups.size) {
		metadataGroupsNormalized.push({
			entries: [...idsNotInGroups].sort((a, b) => blIndex.metadataFields[a].displayName.localeCompare(blIndex.metadataFields[b].displayName)),
			// If there was a group defined from the index config, this is indeed the remainder group, otherwise this is just a normal group.
			isRemainderGroup: hasUserDefinedGroup,
			id: 'Metadata'
		});
	}
	return metadataGroupsNormalized;
}

// -------------

export function normalizeIndex(blIndex: BLTypes.BLIndexMetadata): NormalizedIndex {
	const annotationGroupsNormalized = normalizeAnnotationGroups(blIndex);
	const metadataGroupsNormalized = normalizeMetadataGroups(blIndex);
	const annotatedFields: BLTypes.BLAnnotatedField[] = Object.values(BLTypes.isIndexMetadataV1(blIndex) ? blIndex.complexFields : blIndex.annotatedFields);

	return {
		annotatedFields: mapReduce(annotatedFields.map(normalizeAnnotatedField), 'id'),
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
		metadataFieldGroups: metadataGroupsNormalized,
		metadataFields: mapReduce(Object.values(blIndex.metadataFields).map(normalizeMetadata), 'id'),
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
