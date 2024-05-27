import { BLHit, BLHitSnippet, BLHitSnippetPart, BLRelationMatchList, BLRelationMatchRelation, BLRelationMatchSpan } from '@/types/blacklabtypes';
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
	// We always need to do this.

	const r: HitContext = {
		before: flatten(dir === 'ltr' ? hit.left : hit.right, annotationId, hit.match.punct[0]),
		match: flatten(hit.match, annotationId, (dir === 'ltr' ? hit.right : hit.left)?.punct[0]),
		after: flatten(dir === 'ltr' ? hit.right : hit.left, annotationId)
	};

	// Check if we have the necessary info to continue.
	if (!('start' in hit) || !returnCaptures || !hit.matchInfos) return r;


	// first up: determine which captures to return, just map them into something that's sorted.

	// if there are explicit captures, we want to use those.
	// if there are none, we should fall back to the returned relations
	// we discard the tag information, as that's just document structure, and not very relevant for the user.


	/**
	 * For example: a:"word"
	 * The matchInfos will have this property:
	 *
	 * a: { start: number, end: number, type: 'span' }
	 */
	const explicitCaptures: NormalizedCapture[] = [];
	/**
	 * When running a query with a relation
	 * For example: _ --> a:"word"
	 *
	 * rel: { start: number, end: number, type: 'relation', sourceStart: number, sourceEnd: number, targetStart: number, targetEnd: number, relClass: string, relType: string }
	 * a: { start: number, end: number, type: 'span' }
	 */

	const defaultRelations: NormalizedCapture[] = [];
	/** When running a query with rcapture. */
	const capturedRelations: NormalizedCapture[] = [];

	let allMatches = Object.entries(hit.matchInfos).flatMap<Omit<NormalizedCapture, 'color'|'textcolor'|'textcolorcontrast'>>(([blackLabReportedName, info]) => {
		if (blackLabReportedName === 'captured_rels') return [];

		if (info.type === 'list') return info.infos.map<Omit<NormalizedCapture, 'color'|'textcolor'|'textcolorcontrast'>>(info => ({
			name: info.relType,
			...info,
			isRelation: true
		}));
		else if (info.type === 'relation') return {
			name: info.relType,
			...info,
			isRelation: true
		};
		else if (info.type === 'span') return {
			name: blackLabReportedName,
			sourceEnd: info.end,
			sourceStart: info.start,
			targetEnd: info.end,
			targetStart: info.start,
			isRelation: false
		};
		else return []; // type === 'tag'
	})
	// make sure the indices are consistent, as we assign colors based on the index (so that the same capture always has the same color)
	.sort((a, b) => a.name.localeCompare(b.name));
	// at this point this list is gone and we have a list of relevant captures and relations.


	// If there's explicit captures, use only those.
	if (allMatches.find(c => !c.isRelation)) {
		allMatches = allMatches.filter(c => !c.isRelation);
	}

	const allMatchesWithColors: NormalizedCapture[] = allMatches.map((c, i) => {
		return {
			...c,
			...color(i)
		}
	});

	// allMatches.forEach((capture, index) => {
	// 	// Object.assign((capture as NormalizedCapture), indexToRgb(index));
	// 	let n = 0;

	// 	if (capture.isRelation) n = capturedRelations.push(capture as NormalizedCapture);
	// 	else n = explicitCaptures.push(capture as NormalizedCapture);
	// 	Object.assign((capture as NormalizedCapture), indexToRgb(n-1));
	// });

	// we used to have a fallback to relations, but that just highlights every single word, not very useful.
	const capturesToUse = allMatchesWithColors;

	// we have a full hit, enrich the tokens with capture/relation info.
	for (const [part, context] of Object.entries(r)) {
		const offset = part === 'before' ? hit.start - context.length : part === 'match' ? hit.start : hit.end;

		for (let localIndex = 0; localIndex < context.length; localIndex++) {
			const globalIndex = offset + localIndex;

			const token = context[localIndex];
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
	return r;
}
