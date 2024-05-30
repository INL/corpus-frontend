import { BLHit, BLHitSnippet, BLHitSnippetPart, BLRelationMatchList, BLRelationMatchRelation, BLRelationMatchSpan } from '@/types/blacklabtypes';
import { CaptureAndRelation, HitContext, HitToken } from '@/types/apptypes';


type NormalizedCapture = {
	/** Null for root */
	sourceStart?: number;
	/** Null for root */
	sourceEnd?: number;
	targetStart: number;
	targetEnd: number;

	/** Is this a capture group or a relation */
	isRelation: boolean;

	/** Key of this info. i.e. relation index or capture group name. Can be used for e.g. grouping (and we do use this, mind when refactoring.) */
	key: string;

	/** Display string, key if !isRelation, relation value + arrow if isRelation == true */
	display: string;

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
function flatten(part: BLHitSnippetPart|undefined, annotationId: string, otherAnnotations: string[], lastPunctuation?: string): HitToken[] {
	if (!part) return [];
	/** The result array */
	const r: HitToken[] = [];
	const length = part[annotationId].length;
	for (let i = 0; i < part[annotationId].length; i++) {
		const word = part[annotationId][i];
		const punct =  (i === length - 1 ? lastPunctuation : part.punct[i+1]) || ''; // punctuation is the whitespace before the current word. There is always one more punctuation than there are words in a document (fencepost problem).
		r.push({punct, text: word, annotations: {[annotationId]: word}});
	}
	for (const otherAnnotation of otherAnnotations) {
		for (let i = 0; i < part[otherAnnotation].length; i++) {
			r[i].annotations[otherAnnotation] = part[otherAnnotation][i];
		}
	}
	return r;
}

/**
 * Disaster of a function. Should refactor this when it all works to satisfaction.
 *
 * @param hit - the hit, or most of the hit in case of doc results (which contain less info than hits)
 * @param annotationId - annotation to put in the token's main 'text' property. Usually whatever annotation contains the words.
 * @param otherAnnotations - other annotations to return in the tokens. Lemma, pos, etc. depending on corpus and where in the UI we're showing this.
 * @param dir - direction of the text. LTR or RTL.
 * @param returnCaptures - whether to return captures or not. If false, we don't return any capture info.
 *
 * @returns the hit split into before, match, and after parts, with capture and relation info added to the tokens. The punct is to be shown after the word.
 */
export function snippetParts(hit: BLHit|BLHitSnippet, annotationId: string, otherAnnotations: string[], dir: 'ltr'|'rtl'): HitContext {
	// We always need to do this.

	const tokensPerHitPart: HitContext = {
		before: flatten(dir === 'ltr' ? hit.left : hit.right, annotationId, otherAnnotations, hit.match.punct[0]),
		match: flatten(hit.match, annotationId, otherAnnotations, (dir === 'ltr' ? hit.right : hit.left)?.punct[0]),
		after: flatten(dir === 'ltr' ? hit.right : hit.left, annotationId, otherAnnotations)
	};

	// Only extract captures if have the necessary info to do so.
	if (!('start' in hit) || !hit.matchInfos) return tokensPerHitPart;


	// first up: determine which captures to return, just map them into something that's sorted.

	// if there are explicit captures, we want to use those.
	// if there are none, we should fall back to the returned relations
	// we discard the tag information, as that's just document structure, and not very relevant for the user.

	let allMatches = Object.entries(hit.matchInfos).flatMap<Omit<NormalizedCapture, 'color'|'textcolor'|'textcolorcontrast'>>(([blackLabReportedName, info]) => {
		// don't process the captured relations, as we'd be highlighting every word in the sentence if we did.
		if (blackLabReportedName === 'captured_rels') return [];

		if (info.type === 'list') return info.infos.map<Omit<NormalizedCapture, 'color'|'textcolor'|'textcolorcontrast'>>(info => ({
			...info,
			isRelation: true,

			key: blackLabReportedName,
			display: info.relType,
		}));
		else if (info.type === 'relation') return {
			...info,
			isRelation: true,

			key: blackLabReportedName,
			display: info.relType,
		};
		else if (info.type === 'span') return {
			sourceEnd: info.end,
			sourceStart: info.start,
			targetEnd: info.end,
			targetStart: info.start,
			isRelation: false,

			key: blackLabReportedName,
			display: blackLabReportedName,
		};
		else return []; // type === 'tag'
	})
	// make sure the indices are consistent, as we assign colors based on the index (so that the same capture always has the same color)
	.sort((a, b) => a.key.localeCompare(b.key));
	// at this point this list is gone and we have a list of relevant captures and relations.


	// If there's explicit captures, use only those.
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
					key: c.key,
					display: c.isSource ? c.display + '-->' : c.isTarget ? '-->' + c.display : c.display,
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
