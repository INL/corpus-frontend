// an import or export is required for this to be a "module", which it must be to declare globals (??? - https://stackoverflow.com/questions/42233987/how-to-configure-custom-global-interfaces-d-ts-files-for-typescript/42257742#42257742)
import { BLIndexMetadata } from '@/types/blacklabtypes';
export {};
declare global {


	// ---------------------------
	// valid on all pages
	// ---------------------------
	const INDEX_ID: string;

	const USERNAME: string|null;
	const PASSWORD: string|null;
	const WITH_CREDENTIALS: boolean;

	/** URL for the root path of the frontend. Guaranteed NOT to end in a slash. */
	const CONTEXT_URL: string;
	/** Guaranteed to end in a slash. Does not contain the corpus id. */
	const BLS_URL: string;

	const PLAUSIBLE_DOMAIN: string|null;
	const PLAUSIBLE_APIHOST: string|null;

	// ---------------------------
	// only valid on the article page (/docs/...)
	// ---------------------------
	const DOCUMENT_ID: string;
	const DOCUMENT_LENGTH: number;

	const PAGINATION_ENABLED: boolean;
	const PAGE_SIZE: number;
	const PAGE_START: number;
	const PAGE_END: number;

	// ---------------------------
	// only valid on the search page (/search/...)
	// ---------------------------
	const SINGLEPAGE: { INDEX: BLIndexMetadata; };
	const PROPS_IN_COLUMNS: string[];
	const PAGESIZE: number|undefined;
	const DEBUG_INFO_VISIBLE: boolean;
}