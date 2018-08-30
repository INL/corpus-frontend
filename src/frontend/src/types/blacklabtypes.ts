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
	status: ('empty'|'available'|'indexing'|'opening');
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
