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
}

const hues = [
	0, 120, 240,
	60, 180, 300,
	30, 150, 270,
	90, 210, 330,
	15, 135, 255,
	75, 195, 315,
	45, 165, 285,
	105, 225, 345,
];

/**
 * @param h - hue in [0,360]
 * @param s - saturation in [0,1]
 * @param v - value in [0,1]
 * @returns [r, g, b] in [0,1]
 */
function hsv2rgb(h: number,s: number,v: number) {
	const f = (n: number) => {
		const k = (n+h/60) % 6;
		return v - v*s*Math.max( Math.min(k,4-k,1), 0);
	};
	return [f(5),f(3),f(1)];
}

const indexToRgb = (i: number): string => {
	return `rgb(${hsv2rgb(hues[i % hues.length], 0.8, 0.93).map(c => Math.round(c * 255)).join(',')})`;
}


/**
 * Flatten a set of arrays into an array of sets.
 * { a: [], b: [] } ==> [ { a: '', b: '' }, { a: '', b: '' }]
 *
 * @param part The part of the hit on which to do this.
 * @param annotationId the annotation to extract
 */
function flatten(part: BLHitSnippetPart|undefined, annotationId: string): HitToken[] {
	if (!part) return [];
	/** The result array */
	const r: HitToken[] = [];
	for (let i = 0; i < part[annotationId].length; i++) {
		const word = part[annotationId][i];
		const punct = part.punct[i] || '';
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
		before: flatten(dir === 'ltr' ? hit.left : hit.right, annotationId),
		match: flatten(hit.match, annotationId),
		after: flatten(dir === 'ltr' ? hit.right : hit.left, annotationId)
	};

	// Check if we have the necessary info to continue.
	if (!('start' in hit) || !returnCaptures || !hit.matchInfos) return r;


	// first up: determine which captures to return, just map them into something that's sorted.

	// if there are explicit captures, we want to use those.
	// if there are none, we should fall back to the relation information
	// we discard the tag information, as that's just document structure, and not very relevant for the user.


	const explicitCaptures: NormalizedCapture[] = [];
	const relations: NormalizedCapture[] = [];



	Object.entries(hit.matchInfos).flatMap<Omit<NormalizedCapture, 'color'>>(([blackLabReportedName, info]) => {
		if (info.type === 'list') return info.infos.map<Omit<NormalizedCapture, 'color'>>(info => ({name: info.relClass + ': ' + info.relType, ...info, isRelation: true}));
		else if (info.type === 'relation') return { name: info.relClass + ': ' + info.relType, ...info, isRelation: true };
		else if (info.type === 'span') return { name: blackLabReportedName, sourceEnd: info.end, sourceStart: info.start, targetEnd: info.end, targetStart: info.start, isRelation: false };
		else return []; // type === 'tag'
	})
	// make sure the indices are consistent, as we assign colors based on the index (so that the same capture always has the same color)
	.sort((a, b) => a.name.localeCompare(b.name))
	// at this point this list is gone and we have a list of relevant captures and relations.
	.forEach((capture, index) => {
		(capture as NormalizedCapture).color = indexToRgb(index);
		if (capture.isRelation) relations.push(capture as NormalizedCapture);
		else explicitCaptures.push(capture as NormalizedCapture);
	});


	// we used to have a fallback to relations, but that just highlights every single word, not very useful.
	const capturesToUse = explicitCaptures;

	// const capturesToUse = explicitCaptures.length ? explicitCaptures : relations;
	// console.log(capturesToUse.sort((a, b) => a.sourceStart - b.sourceStart));


	// we have a full hit, enrich the tokens with capture/relation info.
	for (const [part, context] of Object.entries(r)) {
		const offset = part === 'before' ? hit.start - context.length : part === 'hit' ? hit.start : hit.end;

		for (let localIndex = 0; localIndex < context.length; localIndex++) {
			const globalIndex = offset + localIndex;

			const token = context[localIndex];
			const matchedRelations = capturesToUse
				.filter(c => (c.sourceStart ?? -1) <= globalIndex && globalIndex < (c.sourceEnd ?? Number.MAX_SAFE_INTEGER) || c.targetStart <= globalIndex && globalIndex < c.targetEnd)

			token.captureAndRelation = matchedRelations
				.map<CaptureAndRelation>(c => ({
					key: c.name,
					value: c.name,
					color: c.color,
					isSource: c.isRelation && c.sourceStart != null && c.sourceEnd != null && c.sourceStart <= globalIndex && globalIndex < c.sourceEnd,
					isTarget: c.isRelation && c.targetStart <= globalIndex && globalIndex < c.targetEnd,
				}));
		}
	}
	return r;
}
