import * as BLTypes from '@/types/blacklabtypes';

export class ApiError extends Error {
	public readonly title: string;
	public readonly message: string;
	/** http code, -1 if miscellaneous network error */
	public readonly statusText: string;

	constructor(title: string, message: string, statusText: string) {
		super();
		this.title = title;
		this.message = message;
		this.statusText = statusText;
	}
}

// -----------------------
// Blacklab derived types
// -----------------------

// Helper - get all props in A not in B
type Subtract<A, B> = Pick<A, Exclude<keyof A, keyof B>>;

interface INormalizedIndex {
	// new props
	/** ID in the form username:indexname */
	id: string;
	/** username extracted */
	owner: string|null;
	/** indexname extracted */
	shortId: string;

	// original props, with normalized values
	documentFormat: string|null;
	indexProgress: BLTypes.BLIndexProgress|null;
	tokenCount: number|null;
}
export type NormalizedIndex = INormalizedIndex & Subtract<BLTypes.BLIndex, INormalizedIndex>;

interface INormalizedFormat {
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
export type NormalizedFormat = INormalizedFormat & Subtract<BLTypes.BLFormat, INormalizedFormat>;
