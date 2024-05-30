import { BLHit, BLHitSnippet, BLHitSnippetPart, BLMatchInfoList, BLMatchInfoRelation, BLMatchInfoSpan } from '@/types/blacklabtypes';
import { CaptureAndRelation, HitContext, HitToken } from '@/types/apptypes';


type NormalizedCapture = {
	/** Null for root */
	sourceStart?: number;
	/** Null for root */
	sourceEnd?: number;
	targetStart: number;
	targetEnd: number;

	isRelation: boolean;

	/** name of the capture group (key in matchInfos), or the concatenation of relClass and relType. */
	name: string;
	/** Color that it should be highlighed in */
	color: string;
	/** Color text should be on top of the colored background */
	textcolor: string;
	textcolorcontrast: string;
}

// these should be alright for colorblind people.
// taken from https://personal.sron.nl/~pault/#sec:qualitative
const colors = [
	'#77AADD',
	'#EE8866',
	'#EEDD88',
	'#FFAABB',
	'#99DDFF',
	'#44BB99',
	'#BBCC33',
	'#AAAA00',
	'#DDDDDD',
]

const color = (i: number): {color: string, textcolor: string, textcolorcontrast: string} => {
	return {
		color: colors[i % colors.length],
		textcolor: 'black',
		textcolorcontrast: 'white'
	}
}

/**
 * Flatten a set of arrays into an array of sets.
 * { a: [], b: [] } ==> [ { a: '', b: '' }, { a: '', b: '' }]
 *
 * @param part The part of the hit on which to do this.
 * @param annotationId the annotation to extract
 * @param lastPunctuation the punctuation after the last word.
 *                        BlackLab sends punctuation BEFORE the token, with a trailing value at the end,
 *                        we prefer to put punct AFTER the token, because it makes more sense when rendering before/hit/after.
 *                        E.G. "punctuation is dumb, " | "he said", instead of "punctuation is dumb" | ", he said"
 */
function flatten(part: BLHitSnippetPart|undefined, annotationId: string, lastPunctuation?: string): HitToken[] {
	if (!part) return [];
	/** The result array */
	const r: HitToken[] = [];
	const length = part[annotationId].length;
	for (let i = 0; i < part[annotationId].length; i++) {
		const word = part[annotationId][i];
		const punct =  (i === length - 1 ? lastPunctuation : part.punct[i+1]) || ''; // punctuation is the whitespace before the current word. There is always one more punctuation than there are words in a document (fencepost problem).
		r.push({punct, text: word});
	}
	return r;
}

/**
 * Disaster of a function. Should refactor this when it all works to satisfaction.
 *
 * @param hit - the hit, or most of the hit in case of doc results (which contain less info than hits)
 * @param annotationId - annotation to print, usually 'word'.
 * @returns the hit split into before, match, and after parts, with capture and relation info added to the tokens. The punct is to be shown after the word.
 */
export function snippetParts(hit: BLHit|BLHitSnippet, annotationId: string, dir: 'ltr'|'rtl', returnCaptures = true): HitContext {

	if (hit === undefined)
		console.error('hit is undefined');

	// We always need to do this.

	const tokensPerHitPart: HitContext = {
		before: flatten(dir === 'ltr' ? hit.left : hit.right, annotationId, hit.match.punct[0]),
		match: flatten(hit.match, annotationId, (dir === 'ltr' ? hit.right : hit.left)?.punct[0]),
		after: flatten(dir === 'ltr' ? hit.right : hit.left, annotationId)
	};

	// Check if we have the necessary info to continue.
	if (!('start' in hit) || !returnCaptures || !hit.matchInfos) return tokensPerHitPart;


	// first up: determine which captures to return, just map them into something that's sorted.

	// if there are explicit captures, we want to use those.
	// if there are none, we should fall back to the returned relations
	// we discard the tag information, as that's just document structure, and not very relevant for the user.

	let allMatches = Object.entries(hit.matchInfos).flatMap<Omit<NormalizedCapture, 'color'|'textcolor'|'textcolorcontrast'>>(([blackLabReportedName, info]) => {
		// don't process the captured relations, as we'd be highlighting every word in the sentence if we did.
		// (NOTE: "captured_rels" is the default capture name for rcap() operations,
		//        so if the query is "(...SOME_QUERY...) within rcap(<s/>)", the "captured_rels" capture
		//        will contain all relations in the sentence)
		if (blackLabReportedName === 'captured_rels') return [];

		if (info.type === 'list') {
			// A list of relations, such as returned by the ==>TARGETVERSION (parallel alignment) operator
			// or a call to rcap(). Return the captured relations.
			return info.infos.map<Omit<NormalizedCapture, 'color'|'textcolor'|'textcolorcontrast'>>(info => ({
				name: info.relType,
				...info,
				isRelation: true
			}));
		} else if (info.type === 'relation') {
			// A single relation
			return {
				name: info.relType,
				...info,
				isRelation: true
			};
		} else if (info.type === 'span') {
			// A span, e.g. a sentence.
			// Set the source and target to the same span so it's the same structure as a relation.
			return {
				name: blackLabReportedName,
				sourceEnd: info.end,
				sourceStart: info.start,
				targetEnd: info.end,
				targetStart: info.start,
				isRelation: false
			};
		} else {
			return []; // type === 'tag'
		}
	})
	// make sure the indices are consistent, as we assign colors based on the index (so that the same capture always has the same color)
	.sort((a, b) => a.name.localeCompare(b.name));
	// at this point this list is gone and we have a list of relevant captures and relations.


	// If there's explicit captures, use only those.
	//
	// NOTE JN: This feels maybe a little bit surprising and arbitrary; queries that differ only
	//          slightly may highlight very different things, and it might not be obvious to the
	//          average user why. Not sure what a better approach would be, though.
	//
	if (allMatches.find(c => !c.isRelation)) {
		allMatches = allMatches.filter(c => !c.isRelation);
	}

	// Now that we only have the captures/relations we're interested in, we can assign colors to them.
	const allMatchesWithColors: NormalizedCapture[] = allMatches.map((c, i) => ({...c,...color(i)}));

	// we used to have a fallback to relations, but that just highlights every single word, not very useful.
	const capturesToUse = allMatchesWithColors;

	// we have a full hit, enrich the tokens with capture/relation info.
	for (const [part, tokens] of Object.entries(tokensPerHitPart)) {
		// offset is the index of the token in the larger document.
		// ex.
		// hit.before starts at index 1000 in the document
		// hit.match starts at index 1005 in the document
		// we need to match this up with the captures, whose start and end indices are document-wide.
		// so we need to offset the token index by the start of the current part (before, match, after)
		const offset = part === 'before' ? hit.start - tokens.length : part === 'match' ? hit.start : hit.end;

		for (let localIndex = 0; localIndex < tokens.length; localIndex++) {
			const globalIndex = offset + localIndex;

			const token = tokens[localIndex];
			// find any relation that intersects with this token.
			// for the root, sourceStart and sourceEnd are null, if they are, don't match it.
			// (because nearly every token is pointed at by the root. We don't want to highlight everything.)
			const matchedRelations = capturesToUse
				.map(relation => {
					const isSource = (relation.sourceStart ?? Number.MAX_SAFE_INTEGER) <= globalIndex && globalIndex < (relation.sourceEnd ?? -1);
					const isTarget = relation.targetStart <= globalIndex && globalIndex < relation.targetEnd;
					const isMatch = isSource || isTarget;

					return {
						...relation,
						isMatch,
						isSource: relation.isRelation && isSource,
						isTarget: relation.isRelation && isTarget
					};
				})
				.filter(c => c.isMatch);

			token.captureAndRelation = matchedRelations
				.map<CaptureAndRelation>(c => ({
					key: c.isSource ? c.name + '-->' : c.isTarget ? '-->' + c.name : c.name,
					value: c.name,
					color: c.color,
					textcolor: c.textcolor,
					textcolorcontrast: c.textcolorcontrast,
					// we're the source if we're in the source range (we check for null first to make typescript happy, as there's no source for the root relation)
					isSource: c.isRelation && c.sourceStart != null && c.sourceEnd != null && c.sourceStart <= globalIndex && globalIndex < c.sourceEnd,
					// we're the target if we're in the target range
					isTarget: c.isRelation && c.targetStart <= globalIndex && globalIndex < c.targetEnd,
				}));
		}
	}
	return tokensPerHitPart;
}
