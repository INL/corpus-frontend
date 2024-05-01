/** BlackLab query parameters. Is a stricter subset of query parameters blacklab accepts. */
export type BLSearchParameters = {
	/** Limit results to just this document */
	docpid?: string;
	/** Number of results to request */
	number: number;
	/** Index of first result to request */
	first?: number;
	/** Percentage of results to return (0-100), mutually exclusive with 'samplenum' */
	sample?: number;
	/** Sample up to a flat number of results from the total result set, mutually exclusive with 'sample' */
	samplenum?: number;
	/** Seed from which the samples are generated */
	sampleseed?: number;
	/** Context size, may be limited by blacklab. A number for words before and after the hit, or an inline element such as "s", "p", etc. Depending on corpus. See "inlineTags" in input format (*.blf.yaml), or available from getRelations in the api. */
	context?: number|string;
	/** How to filter results: a lucene query */
	filter?: string;
	/** How to sort results, comma-separated list of field:${someMetadataFieldId} or (wordleft|hit|wordright):${someAnnotationId} */
	group?: string;
	/** Parallel corpus source field to search (defaults to main version) */
	field?: string;
	/** CQL query */
	patt?: string;
	/**
	 * CQL query gap-filling values, contents of a tsv file in string form.
	 *
	 * See http://inl.github.io/BlackLab/blacklab-server-overview.html#requests
	 */
	pattgapdata?: string;
	/** How to sort results, comma-separated list of field:${someMetadataFieldId} or (wordleft|hit|wordright):${someAnnotationId} */
	sort?: string;
	/** Also return results within this specific group (only when 'group' specified) */
	viewgroup?: string;

	// additionals that aren't used often
	/** Include the total number of tokens in documents containing matches */
	includetokencount?: boolean;
	/** Block until all results have been found */
	waitfortotal?: boolean;
	/** List of comma-separated annotation IDs to include in the kwic data. */
	listvalues?: string;
	/** List of comma-separated metadata IDs to include in document info. */
	listmetadatavalues?: string;

	/** maximum hits to count outside requested window (only does something when > first+number) */
	maxcount?: number;
	/** maximum hits to actually retrieve (only does something when > first+number) */
	maxretrieve?: number;

	/** When using relation matching in pattern, widen the match part of the hit to contain both source and target. */
	adjusthits?: 'yes';
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
		stackTrace?: string;
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
	description: string;
	displayName: string;
	/** key of a BLFormat */
	documentFormat?: string;
	/** Only available when status === 'indexing' */
	indexProgress?: BLIndexProgress;
	/** status opening is currently unused, but should be treated as generally unavailable */
	status: 'empty'|'available'|'indexing'|'opening';
	/** yyyy-mm-dd hh:mm:ss */
	timeModified: string;
	/** Number of tokens in this index (excluding those tokens added in any currently running indexing action). */
	tokenCount?: number;
	/** v4 and up: token count per annotatedField. */
	tokenCounts?: Array<{fieldName: string; tokenCount: number}>
	/** Number of documents in this index (excluding any added in a currently running indexing action). Not present pre-v4 */
	documentCount?: number;
}

export interface BLRelationInfo {
	/** "inline tags" in the corpus, with their number of occurances. */
	spans: Record<string, number>;
	/** Only when relations have been indexed in this corpus. */
	relations?: {
		/** Relations are always stored in a "dep" property for now? */
		dep: Record<string, number>;
	}
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
	maxSearchAgeSec: number;
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
	corpora: {
		[key: string]: BLIndex;
	};
	user: BLUser;
}

// ----------------------------
// IndexStructure/IndexMetadata
// ----------------------------

export type BLDocFields = {
	/** Key to a field in BLDocInfo, missing if unknown */
	authorField?: string;
	/** Key to a field in BLDocInfo, missing if unknown */
	dateField?: string;
	/** Key to a field in BLDocInfo, missing if unknown */
	pidField?: string;
	/** Key to a field in BLDocInfo, missing if unknown */
	titleField?: string;
};

/** Property of a word, usually 'lemma', 'pos', 'word' */
export interface BLAnnotation {
	description: string;
	displayName: string;
	hasForwardIndex: boolean;
	isInternal: boolean;
	offsetsAlternative: string;
	sensitivity: 'SENSITIVE_AND_INSENSITIVE'|'SENSITIVE'|'INSENSITIVE';
	/** Contains ids of other BLAnnotations in the parent annotatedField if this field has subannotations. */
	subannotations?: string[];
	uiType: string|'select'|'combobox'|'text'|'pos'|'dropdown'|'autocomplete';
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
}
type BLAnnotatedFieldV1 = BLAnnotatedFieldInternal&{
	/** Indexed token properties/annotations for this field */
	properties: { [key: string]: BLAnnotation; };
	/** If a cql query is fired that is just "searchterm", this is the annotation that is searched, usually 'word' - key in annotations */
	mainProperty: string;
};
type BLAnnotatedFieldV2 = BLAnnotatedFieldInternal&{
	/** Indexed token properties/annotations for this field */
	annotations: { [key: string]: BLAnnotation; },
	/** Ids of the annotations, in the order they should be displayed by the ui */
	displayOrder?: string[];
	/** If a cql query is fired that is just "searchterm", this is the annotation that is searched, usually 'word' - key in annotations */
	mainAnnotation: string;
};
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
	/** All the types we support are listed here, though the types are user-defined so in anything can show up. */
	uiType: string|'select'|'range'|'combobox'|'text'|'checkbox'|'radio'|'autocomplete'|'dropdown';
	/** Internal blacklab property: when the unknownValue is used as the value for a document where the metadata for this field was unknown when indexing */
	unknownCondition: 'NEVER'|'MISSING'|'EMPTY'|'MISSING_OR_EMPTY';
	/** Internal blacklab property: what default value is substituted during indexing for document that are missing this metadata (depending on unknownCondition) */
	unknownValue: string;
	/** Are all values contained within the fieldValues */
	valueListComplete: boolean;
}

/** Contains information about the internal structure of the index - which fields exist for tokens, which metadata fields exist for documents, etc */
export interface BLIndexMetadata {
	/** Always present, except in really old versions of blacklab */
	annotationGroups?: {
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
	fieldInfo: BLDocFields;
	/** Id of this index */
	indexName: string;
	/** Only available when status === 'indexing' */
	indexProgress?: BLIndexProgress;
	/** Always present, but may be empty if no metadata groups are defined in the index config. */
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
		/** BlackLab version when the index was created. In Maven format */
		blackLabVersion: string;
		/** major.minor */
		indexFormat: string;
		/** yyyy-mm-dd hh:mm:ss */
		timeCreated: string;
		/** yyyy-mm-dd hh:mm:ss */
		timeModified: string;
	};

	annotatedFields: {[id: string]: BLAnnotatedFieldV2};
	/** key into annotatedFields */
	mainAnnotatedField: string;
	/** Only available if index contains actual documents and if versionInfo.blackLabVersion >= 2.0.0 */
	documentCount: number;
};

export type BLDocument = {
	docPid: string;
	docInfo: BLDocInfo;
	docFields: BLDocFields;
};

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

// TODO - incomplete
export type BLSearchSummary = {
	actualWindowSize: number;
	countTime?: number;
	/** These fields have a special meaning in the BLDocResult.docInfo */
	docFields: BLDocFields;
	requestedWindowSize: number;
	searchParam: BLSearchParameters;
	searchTime: number;
	/** Only available when request was sent with includetokencount: true */
	tokensInMatchingDocuments?: number;
	windowFirstResult: number;
	windowHasNext: boolean;
	windowHasPrevious: boolean;
} & BLSearchSummarySampleSettings;

export interface BLSearchSummaryTotalsDocs {
	/** Total documents across all counted (not retrieved) hits, -1 if some error occured */
	numberOfDocs: number;
	/** Total documents across all retrieved hits */
	numberOfDocsRetrieved: number;
	/** Is any hit counting ongoing, generally true unless blacklab finished counting all results or results exceed the count limit (stoppedCountingHits = true) */
	stillCounting: boolean;
}

export interface BLSearchSummaryTotalsHits extends BLSearchSummaryTotalsDocs {
	/** Total number of counted hits (so far), -1 if some error occured */
	numberOfHits: number;
	/** Total number of retrieved hits (so far) */
	numberOfHitsRetrieved: number;
	/** Did the query hit the default count limit (defaultMaxHitsToCount) */
	stoppedCountingHits: boolean;
	/** Did the query hit the default retrieval limit (defaultMaxHitsToRetrieve) */
	stoppedRetrievingHits: boolean;
}

export interface BLSearchSummaryGroupInfo {
	largestGroupSize: number;
	numberOfGroups: number;
}

export interface BLSearchSummaryGroupInfoHits extends BLSearchSummaryGroupInfo {
	/**
	 * Contains the size of the entire searched subcorpus (e.g. number of docs and tokens found by the same query without a cql pattern).
	 * Only present when the query is not grouping results based on document metadata.
	 *
	 * When results ARE grouped based on document metadata, is present in the individual HitGroups instead.
	 * Then it contains the total number of documents in the group, along with their total number of tokens.
	 */
	subcorpusSize?: {
		/** NOTE: may be 0 in rare cases, when specifying a search for the empty value for all metadata fields */
		documents: number;
		/** NOTE: may be 0 in rare cases, when specifying a search for the empty value for all metadata fields */
		tokens: number;
	};
}

export interface BLSearchSummaryGroupInfoDocs extends BLSearchSummaryGroupInfo {
	/**
	 * Contains the size of the entire searched subcorpus (e.g. number of docs and tokens found by the same query without a cql pattern).
	 *
	 * Only present when the query does not contain a cql pattern.
	 * If the query does contain a cql pattern, subcorpusSize is instead defined per docGroup, and contains the size of that group if the cql pattern would not exist.
	 */
	subcorpusSize?: {
		documents: number;
		tokens: number;
	};
}

/** Single group of either hits or documents */
export interface BLGroupResult {
	identity: string;
	identityDisplay: string;
	size: number;
	/** Individual property values that identify this group. Whereas identity and identityDisplay are encoded cq. preformatted, these are the raw values. */
	properties: Array<{
		name: string,
		value: string
	}>
}

export interface BLHitGroupResult extends BLGroupResult {
	/** When grouped on annotation + metadata */
	numberOfDocs: number;
	/** Present when grouped on at least one metadata field, otherwise use subcorpusSize in BLSearchSummaryHitsGrouped */
	subcorpusSize?: {
		/** Number of documents this group including those documents that do not contain a hit. */
		documents: number;
		/** Total number of tokens in those documents */
		tokens: number;
	};
}

export interface BLDocGroupResult extends BLGroupResult {
	/** Total number of tokens across all documents in this group */
	numberOfTokens: number;
	/** Present when the query contains a pattern, otherwise use subcorpusSize in BLSearchSummaryDocsGrouped */
	subcorpusSize?: {
		/** Number of documents this group including those documents that do not contain a hit. */
		documents: number;
		/** Total number of tokens in those documents */
		tokens: number;
	};
}

/** Blacklab response for a query for hits with grouping enabled */
export interface BLHitGroupResults {
	hitGroups: BLHitGroupResult[];
	summary: BLSearchSummary & BLSearchSummaryGroupInfoHits & BLSearchSummaryTotalsHits;
}

/** Blacklab response for a query for documents with grouping enabled */
export interface BLDocGroupResults {
	docGroups: BLDocGroupResult[];
	summary: BLSearchSummary & BLSearchSummaryGroupInfoDocs & BLSearchSummaryTotalsDocs;
}

/** Contains a hit's tokens, deconstructed into the individual annotations/properties, such as lemma, pos, word, always contains punctuation in between tokens */
export interface BLHitSnippetPart {
	/**
	 * Punctuation always exists (even if only an empty string or a space).
	 * Punctuation at a token comes BEFORE the word.
	 * The final punctuation (e.g. trailing '?', '.', etc.) is therefor at document length + 1.
	 * This gives a bit of mess in hits, because the punctuation trailing the "before" part of the hit is contained in the match at index 0.
	 * Likewise, punctuation at the end of the hit is contained in the "after" context at index 0.
	 */
	punct: string[];
	/** Usually this contains fields like lemma, word, pos */
	[key: string]: string[]; // Jesse: Need something for the captures here
}

/** A subset of a BLHit, returned in document requests (/docs) when there are also hits. */
export type BLHitSnippet = {
	/** Omitted if snippet is at start of document */
	left?: BLHitSnippetPart;
	/** Omitted if snippet is at end of document */
	right?: BLHitSnippetPart;
	match: BLHitSnippetPart;
}

/** When tagging part of the query like a:[] returns the start and end of the [] */
export interface BLRelationMatchSpan {
	type: 'span';
	start: number;
	end: number;
}

/** Something like "within <s/>" */
export interface BLRelationMatchTag {
	type: 'tag';
	start: number;
	end: number;
}

export interface BLRelationMatchRelation {
	type: 'relation';
	/** Usually "dep" for "dependency", but ultimately up to the user.
	 * multiple types of relations can be indexed if the user wishes to. (such as between equal words in different languages, grammatical relations between words in the same sentence, etc.)
	 */
	relClass: string;
	/** The value of the relation. */
	relType: string;

	/** Inclusive index. Not present for root relations */
	sourceStart?: number;
	/** Exclusive index. Not present for root relations */
	sourceEnd?: number;
	/** Inclusive index */
	targetStart: number;
	/** Exclusive index */
	targetEnd: number;

	/** Smallest of sourceStart and targetStart? */
	start: number;
	/** Smallest of targetStart and targetEnd? */
	end: number;
}

export interface BLRelationMatchList {
	type: 'list';
	start: number;
	end: number;
	infos: Array<BLRelationMatchRelation>
}

// DEPRECATED: use matchInfos instead
// export interface BLCaptureGroup  { // Jesse
// 	name: string;
// 	start: number;
// 	end: number;
// }

export type BLHit = BLHitSnippet&{
	docPid: string;
	start: number;
	end: number;
	/**
	 * Contains the relevant info about <br>
	 * A) capture groups: tokens with a label in the query, such as a:[pos="..."] would result in {a: {start: x, end: y, type: 'span'}})
	 * B) relations: if querying for tokens with a relation (for example _ -obj-> _), the info about this relation and the (source, target) tokens are also stored here.
	 * The above query could result for example in:
	 *  obj: {
	 *    type: "relation",
	 *    relClass: "dep",
	 *    relType: "obj",
	 *    sourceStart: 26,
	 *    sourceEnd: 27,
	 *    targetStart: 25,
	 *    targetEnd: 26,
	 *    start: 25,
	 *    end: 27
	 *  }
	 */
	matchInfos?: {
		context_rels?: BLRelationMatchList;
	}&Record<string, BLRelationMatchSpan|BLRelationMatchRelation|BLRelationMatchTag>
};

/** Contains occurance counts of terms in the index */
export interface BLTermOccurances {
	termFreq: {
		[term: string]: number
	};
}

/** Contains all metadata for a document. Fields without indexed values are omitted! */
export type BLDocInfo = {
	lengthInTokens: number;
	mayView: boolean;
}&{
	[key: string]: string[];
};

export type BLDoc = {
	docInfo: BLDocInfo;
	docPid: string;
	/* Only when query was performed with a cql pattern */
	numberOfHits?: number;
	/* Only when query was performed with a cql pattern */
	snippets?: BLHitSnippet[];
}

/** Blacklab response to a query for documents without grouping */
export interface BLDocResults {
	docs: BLDoc[];
	/** All of the hit properties exist or none of them do, depending on whether a pattern was supplied */
	summary: BLSearchSummary & BLSearchSummaryTotalsDocs & Partial<BLSearchSummaryTotalsHits>;
}

/** Blacklab response to a query for hits without grouping */
export interface BLHitResults {
	docInfos: Record<string, BLDocInfo>;
	hits: BLHit[];
	summary: BLSearchSummary & BLSearchSummaryTotalsHits;
}

export type BLSearchResult = BLHitResults|BLDocResults|BLHitGroupResults|BLDocGroupResults;

export const isHitResults = (d: any): d is BLHitResults => !!(d && d.docInfos && d.hits);
export const isDocResults = (d: any): d is BLDocResults => !!(d && d.docs);
export const isHitGroups = (d: any): d is BLHitGroupResults => !!(d && d.hitGroups);
export const isDocGroups = (d: any): d is BLDocGroupResults => !!(d && d.docGroups);
export const isHitGroupsOrResults = (d: any): d is BLHitResults|BLHitGroupResults => isHitGroups(d) || isHitResults(d);
export const isDocGroupsOrResults = (d: any): d is BLDocResults|BLDocGroupResults => isDocGroups(d) || isDocResults(d);
export const isGroups = (d: any): d is BLHitGroupResults|BLDocGroupResults => isHitGroups(d) || isDocGroups(d);
export const isBLError = (e: any): e is BLError => !!(e && e.error && e.error.code && e.error.message);
