import {NormalizedIndex, NormalizedFormat} from '@/types/apptypes';
import * as BLTypes from '@/types/blacklabtypes';

export function isBLError(e: any): e is BLTypes.BLError {
	return !!e && !!e.error && !!e.error.code && !!e.error.message;
}

export function normalizeIndex(id: string, index: BLTypes.BLIndex): NormalizedIndex {
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

export function normalizeIndices(info: BLTypes.BLServer): NormalizedIndex[] {
	return Object.entries(info.indices)
	.map(([key, value]) => normalizeIndex(key, value));
}

export function normalizeFormat(id: string, format: BLTypes.BLFormat): NormalizedFormat {
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

export function normalizeFormats(formats: {[key: string]: BLTypes.BLFormats}): NormalizedFormat[] {
	return Object.entries(formats.supportedInputFormats)
	.map(([key, value]) => normalizeFormat(key, value));
}
