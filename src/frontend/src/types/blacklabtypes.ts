// import { BlacklabParameters } from '@/modules/singlepage-bls';

/** BlackLab query parameters. Is a stricter subset of query parameters blacklab accepts. */
export type BlacklabParameters = {
	/* Number of results to request */
	number: number;
	/* Index of first result to request */
	first: number;
	/* percentage of results to return (0-100), mutually exclusive with 'samplenum' */
	sample?: number;
	/* How many results to return, mutually exclusive with 'sample' */
	samplenum?: number;
	/* Seed from which the samples are generated */
	sampleseed?: number;
	/* Context size, may be limited by blacklab */
	wordsaroundhit?: number;
	filter?: string;
	group?: string;
	/* CQL query */
	patt?: string;
	sort?: string;
	/* Also return results within this specific group (only when 'group' specified) */
	viewgroup?: string;

	// additionals that aren't used often
	includetokencount?: boolean;
};

// --------------
// Base responses
// --------------

export interface BLResponse {
	status: {
		code: string;
		message: string;
	};
}

export interface BLError {
	error: {
		code: string;
		message: string;
	};
}

export function isBLError(e: any): e is BLError {
	return !!e && !!e.error && !!e.error.code && !!e.error.message;
}

// ------------------------
// Index status/server info
// ------------------------

export interface BLIndexProgress {
	/** Number of documents finished in this indexing action so far. */
	docsDone: number;
	/** Number of .xml files indexed in this indexing action so far. */
	filesProcessed: number;
	/** Number of tokens finished in this indexing action so far. */
	tokensProcessed: number;
}

// Optional values have the null type added as that allows us to
// set them to null when they're missing.
export interface BLIndex {
	displayName: string;
	/** key of a BLFormat */
	documentFormat?: string;
	/** Only available when status === 'indexing' */
	indexProgress?: BLIndexProgress;
	/** status opening is currently unused, but should be treated as generally unavailable */
	status: 'empty'|'available'|'indexing'|'opening';
	timeModified: string;
	/** Number of tokens in this index (excluding those tokens added in any currently running indexing action). */
	tokenCount?: number;
}

export interface BLUser {
	/** When !loggedIn: false, when loggedIn, true/false depending on whether user has hit the private corpora limit. */
	canCreateIndex: boolean;
	/** Only available when loggedIn */
	id?: string;
	loggedIn: boolean;
}

/** Info about users an index is shared with, entries are usernames */
export type BLShareInfo = string[];

export interface BLCacheStatus {
	maxNumberOfSearches: number;
	maxSearchAgeSex: number;
	maxSizeBytes: number;
	numberOfSearches: number;
	sizeBytes: number;
}

export interface BLFormat {
	configurationBased: boolean;
	/** Often empty */
	description: string;
	/** Often empty */
	displayName: string;
	/** Often empty */
	helpUrl: string;
	isVisible: boolean;
}

export interface BLFormatContent {
	/** id */
	formatName: string;
	/** usually one of 'yml', 'yaml', 'json', lowercased */
	configFileType: 'json'|'yml'|'yaml'|string;
	/** contents of the file, treat with caution: user content! */
	configFile: string;
}

export interface BLFormats {
	user: BLUser;
	supportedInputFormats: {
		[key: string]: BLFormat;
	};
}

export interface BLServer {
	blacklabBuildTime: string;
	blacklabVersion: string;
	cacheStatus?: BLCacheStatus;
	helpPageUrl: string;
	indices: {
		[key: string]: BLIndex;
	};
	user: BLUser;
}

// ----------------------------
// IndexStructure/IndexMetadata
// ----------------------------

/** Property of a word, usually 'lemma', 'pos', 'word' */
export interface BLAnnotation {
	description: string;
	displayName: string;
	hasForwardIndex: boolean;
	isInternal: boolean;
	offsetsAlternative: string;
	sensitivity: 'SENSITIVE_AND_INSENSITIVE'|'SENSITIVE'|'INSENSITIVE';
	uiType: string|'select'|'combobox'|'text';
	/** Only when the indexMetadata was requested with ?listvalues=annotationId,annotationId etc. */
	values?: string[];
	/** Only when values present. */
	valueListComplete?: boolean;
}

/** A set of annotations that form one data set on a token, usually there is only one of these in an index, called 'content' */
interface BLAnnotatedFieldInternal  {
	description: string;
	displayName: string;
	/** Identical to key for this annotatedField */
	fieldName: string;
	hasContentStore: boolean;
	hasLengthTokens: boolean;
	hasXmlTags: boolean;
	isAnnotatedField: boolean;
	/** If a cql query is fired that is just "searchterm", this is the annotation that is searched, usually 'word' - key in annotations */
	mainProperty: string;
}
type BLAnnotatedFieldV1 = BLAnnotatedFieldInternal&{ properties: { [key: string]: BLAnnotation; }; };
type BLAnnotatedFieldV2 = BLAnnotatedFieldInternal&{ annotations: { [key: string]: BLAnnotation; }; };
export type BLAnnotatedField = BLAnnotatedFieldV1|BLAnnotatedFieldV2;
export function isAnnotatedFieldV1(v: BLAnnotatedField): v is BLAnnotatedFieldV1 { return (v as any).properties != null; }

export interface BLMetadataField {
	analyzer: string;
	description: string;
	displayName: string;
	displayValues: {
		/** Alternate display names/values for values in this field. */
		[key: string]: string;
	};
	/** Key of this metadataField */
	fieldName: string;
	fieldValues: {
		/** Keys are the values for this field, whereas the value for each key is the number of occurances */
		[key: string]: string;
	};
	isAnnotatedField: boolean;
	type: 'TOKENIZED'|'UNTOKENIZED'|'NUMERIC';
	uiType: string|'select'|'range'|'combobox'|'text'|'checkbox'|'radio';
	/** Internal blacklab property: when the unknownValue is used as the value for a document where the metadata for this field was unknown when indexing */
	unknownCondition: 'NEVER'|'MISSING'|'EMPTY'|'MISSING_OR_EMPTY';
	/** Internal blacklab property: what default value is substituted during indexing for document that are missing this metadata (depending on unknownCondition) */
	unknownValue: string;
	/** Are all values contained within the fieldValues */
	valueListComplete: boolean;
}

/** Contains information about the internal structure of the index - which fields exist for tokens, which metadata fields exist for documents, etc */
export interface BLIndexMetadataInternal {
	annotationGroups: {
		[annotatedFieldId: string]: Array<{
			name: string;
			/** Referring to BLAnnotatedField in the annotatedFields[annotatedFieldId] */
			annotations: string[];
		}>
	};
	contentViewable: boolean;
	/** Description of the main index */
	description: string;
	displayName: string;
	/** key of a BLFormat */
	documentFormat?: string;
	fieldInfo: {
		/** Key to a field in BLDocInfo, empty if unknown */
		authorField: string;
		/** Key to a field in BLDocInfo, empty if unknown */
		dateField: string;
		/** Key to a field in BLDocInfo, empty if unknown */
		pidField: string;
		/** Key to a field in BLDocInfo, empty if unknown */
		titleField: string;
	};
	/** Id of this index */
	indexName: string;
	/** Only available when status === 'indexing' */
	indexProgress?: BLIndexProgress;
	metadataFieldGroups: Array<{
		name: string;
		/** Keys in metadataFields */
		fields: string[];
	}>;
	metadataFields: { [key: string]: BLMetadataField; };
	status: 'empty'|'available'|'indexing'|'opening';
	textDirection: 'ltr'|'rtl';
	/** Number of tokens in this index (excluding those tokens added in any currently running indexing action). - not available if status === 'empty' */
	tokenCount?: number;
	versionInfo: {
		blackLabBuildTime: string;
		blackLabVersion: string;
		/** major.minor */
		indexFormat: string;
		/** yyyy-mm-dd hh:mm:ss */
		timeCreated: string;
		/** yyyy-mm-dd hh:mm:ss */
		timeModified: string;
	};
}
type BLIndexMetadataV1 = BLIndexMetadataInternal&{complexFields: {[id: string]: BLAnnotatedFieldV1}; };
type BLIndexMetadataV2 = BLIndexMetadataInternal&{annotatedFields: {[id: string]: BLAnnotatedFieldV2}; };
export type BLIndexMetadata = BLIndexMetadataV1|BLIndexMetadataV2;
export function isIndexMetadataV1(v: BLIndexMetadata): v is BLIndexMetadataV1 { return (v as any).complexFields != null; }

// --------------
// Search results
// --------------

export type BLSearchSummarySampleSettings = {} | {
	samplePercentage: number;
	sampleSeed: number;
} | {
	sampleSeed: number;
	sampleSize: number;
};

export interface BLSearchSummaryTotalsHits {
	/* -1 if some error occured */
	numberOfDocs: number;
	numberOfDocsRetrieved: number;
	/* -1 if some error occured */
	numberOfHits: number;
	numberOfHitsRetrieved: number;
	stillCounting: boolean;
	stoppedCountingHits: boolean;
	stoppedRetrievingHits: boolean;
}

export interface BLSearchSummaryTotalsDocs {
	/** -1 if some error occured */
	numberOfDocs: number;
	numberOfDocsRetrieved: number;
	stillCounting: boolean;
}

export interface BlSearchSummaryGroupInfo {
	largestGroupSize: number;
	numberOfGroups: number;
}

// TODO - incomplete
export type BLSearchSummary = {
	actualWindowSize: number;
	countTime?: number;
	/** These fields have a special meaning in the BLDocResult.docInfo */
	docFields: {
		// TODO - might be optional or might contain extra fields?
		authorField: string;
		dateField: string;
		pidField: string;
		titleField: string;
	};
	requestedWindowSize: number;
	searchParam: BlacklabParameters;
	searchTime: number;
	/** Only available when request was sent with includetokencount: true */
	tokensInMatchingDocuments?: number;
	windowFirstResult: number;
	windowHasNext: boolean;
	windowHasPrevious: boolean;
} & BLSearchSummarySampleSettings;

/** Single group of either hits or documents */
export interface GroupResult {
	identity: string;
	identityDisplay: string;
	size: number;
}

/** Blacklab response for a query for hits with grouping enabled */
export interface BLHitGroupResults {
	hitGroups: GroupResult[];
	summary: BLSearchSummary & BlSearchSummaryGroupInfo & BLSearchSummaryTotalsHits;
}

/** Blacklab response for a query for documents with grouping enabled */
export interface BLDocGroupResults {
	docGroups: GroupResult[];
	summary: BLSearchSummary & BlSearchSummaryGroupInfo & BLSearchSummaryTotalsDocs;
}

/** Contains a hit's tokens, deconstructed into the individual annotations/properties, such as lemma, pos, word, always contains punctuation in between tokens */
export interface BLHitSnippetPart {
	/** Punctuation always exists (even if only an empty string or a space) */
	punct: string[];
	/** Usually this contains fields like lemma, word, pos */
	[key: string]: string[];
}

/** Contains all the AnnotatedField (previously token/word "properties") values for tokens in or around a hit */
export interface BLHitSnippet {
	left: BLHitSnippetPart;
	match: BLHitSnippetPart;
	right: BLHitSnippetPart;
}

/** Contains all metadata for a document */
export interface BLDocInfo {
	[key: string]: string;
}

/** Blacklab response to a query for documents without grouping */
export interface BLDocResults {
	docs: Array<{
		docInfo: BLDocInfo;
		docPid: string;
		/* Only when query was performed with a cql pattern */
		numberOfHits?: number;
		/* Only when query was performed with a cql pattern */
		snippets?: BLHitSnippet[];
	}>;
	summary: BLSearchSummary & BLSearchSummaryTotalsDocs;
}

/** Blacklab response to a query for hits without grouping */
export interface BlHitResults {
	docInfos: {
		[key: string]: BLDocInfo;
	};
	hits: Array<{
		docPid: string;
		end: number;
		start: number;
	} & BLHitSnippet>;
	summary: BLSearchSummary & BLSearchSummaryTotalsHits;
}

export type BLSearchResult = BlHitResults|BLDocResults|BLHitGroupResults|BLDocGroupResults;

export const isHitResults = (d: any): d is BlHitResults => d && d.docInfos && d.hits;
export const isDocResults = (d: any): d is BLDocResults => d && d.docs;
export const isHitGroups = (d: any): d is BLHitGroupResults => d && d.hitGroups;
export const isDocGroups = (d: any): d is BLDocGroupResults => d && d.docGroups;
export const isGroups = (d: any): d is BLHitGroupResults|BLDocGroupResults => isHitGroups(d) || isDocGroups(d);
