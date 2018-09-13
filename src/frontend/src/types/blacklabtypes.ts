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
}

/** A set of annotations that form one data set on a token, usually there is only one of these in an index, called 'content' */
export interface BLAnnotatedField {
	annotations: {
		[key: string]: BLAnnotation;
	};
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
	type: string; // TODO enum
	uiType: string|'select'|'range'|'combobox'|'text';
	unknownCondition: string;
	unknownValue: string;
	/** Are all values contained within the fieldValues */
	valueListComplete: boolean;
}

// TODO also allow older version, annotatedFields are complexFields and some other change -- see corpus-frontend/CorpusConfig.java
/** Contains information about the internal structure of the index - which fields exist for tokens, which metadata fields exist for documents, etc */
export interface BLIndexMetadata {
	annotatedFields: { [key: string]: BLAnnotatedField; };
	annotationGroups: {
		// TODO
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

// --------------
// Search results
// --------------

type BLSearchSummarySampleSettings = {} | {
	samplePercentage: number;
	sampleSeed: number;
} | {
	sampleSeed: number;
	sampleSize: number;
};

interface BLSearchSummaryTotals {
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

interface BlSearchSummaryGroupInfo {
	largestGroupSize: number;
	numberOfGroups: number;
}

// TODO - incomplete
export type BLSearchSummary = {
	actualWindowSize: number;
	countTime?: number;
	/** These fields have a special meaning in the BLDocResult.docInfo */
	docFields: {
		// TODO - might be optional or might contain extra?
		titleField: string;
		authorField: string;
		dateField: string;
	};
	requestedWindowSize: number;
	searchParam: any;
	searchTime: number;
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
	summary: BLSearchSummary & BlSearchSummaryGroupInfo & BLSearchSummaryTotals;
}

/** Blacklab response for a query for documents with grouping enabled */
export interface BLDocGroupResults {
	docGroups: GroupResult[];
	summary: BLSearchSummary & BlSearchSummaryGroupInfo & BLSearchSummaryTotals;
}

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
	summary: BLSearchSummary & BLSearchSummaryTotals;
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
	summary: BLSearchSummary & BLSearchSummaryTotals;
}

export type BLSearchResult = BlHitResults|BLDocResults|BLHitGroupResults|BLDocGroupResults;

export const isHitResults = (d): d is BlHitResults => d && d.docInfos && d.hits;
export const isDocResults = (d): d is BLDocResults => d && d.docs;
export const isHitGroups = (d): d is BLHitGroupResults => d && d.hitGroups;
export const isDocGroups = (d): d is BLDocGroupResults => d && d.docGroups;
export const isGroups = (d): d is BLHitGroupResults|BLDocGroupResults => isHitGroups(d) || isDocGroups(d);

// -----------------------
// Blacklab derived types
// -----------------------

// Helper - get all props in A not in B
type Subtract<A, B> = Pick<A, Exclude<keyof A, keyof B>>;

interface NormalizedIndex_ { // tslint:disable-line
	// new props
	/** ID in the form username:indexname */
	id: string;
	/** username extracted */
	owner: string|null;
	/** indexname extracted */
	shortId: string;

	// original props, with normalized values
	documentFormat: string|null;
	indexProgress: BLIndexProgress|null;
	tokenCount: number|null;
}
export type NormalizedIndex = NormalizedIndex_ & Subtract<BLIndex, NormalizedIndex_>;

interface NormalizedFormat_ { // tslint:disable-line
	// new props
	id: string;
	/** Username extracted */
	owner: string|null;
	/** internal name extracted */
	shortId: string;

	// original props, with normalized values
	/** Null if would be empty originally */
	helpUrl: string|null;
	/** Null if would be empty originally */
	description: string|null;
	/** set to shortId if originally empty */
	displayName: string;
}
export type NormalizedFormat = NormalizedFormat_ & Subtract<BLFormat, NormalizedFormat_>;
