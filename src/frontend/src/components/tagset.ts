export type NormalizedTagset = {
	/** Referring to the annotation for which the values exist, this is the annotation under which the main part-of-speech category is stored ('ww', 'vnw' etc) */
	annotationId: string;
	/**
	 * All known values for this annotation.
	 * The raw values can be gathered from blacklab
	 * but displaynames, and the valid constraints need to be manually configured.
	 */
	values: {
		[key: string]: {
			value: string;
			displayName: string;
			/** All subannotations that can be used on this type of part-of-speech */
			subAnnotationIds: Array<keyof NormalizedTagset['subAnnotations']>;
		}
	};
	/**
	 * All subannotations of the main annotation
	 * Except the displayNames for values, we could just autofill this from blacklab.
	 */
	subAnnotations: {
		[key: string]: {
			id: string;
			displayName: string;
			/** The known values for the subannotation */
			values: Array<{
				value: string;
				displayName: string;
			}>;
		};
	};
};

export const sonarTagset: NormalizedTagset = {
	annotationId: 'pos_head',
	values: {
		lid: {
			value: 'lid',
			displayName: 'LID',
			subAnnotationIds: [
				'pos_buiging',
				'pos_lwtype',
				'pos_naamval',
				'pos_npagr'
			]
		},
		tw: {
			value: 'tw',
			displayName: 'TW',
			subAnnotationIds: [
				'pos_buiging',
				'pos_graad',
				'pos_numtype',
				'pos_positie'
			]
		},
		n: {
			value: 'n',
			displayName: 'N',
			subAnnotationIds: [
				'pos_buiging',
				'pos_genus',
				'pos_getal',
				'pos_graad',
				'pos_naamval',
				'pos_ntype'
			]
		},
		vg: {
			value: 'vg',
			displayName: 'VG',
			subAnnotationIds: [
				'pos_conjtype'
			]
		},
		tsw: {
			value: 'tsw',
			displayName: 'TSW',
			subAnnotationIds: [

			]
		},
		adj: {
			value: 'adj',
			displayName: 'ADJ',
			subAnnotationIds: [
				'pos_buiging',
				'pos_getal',
				'pos_getal-n',
				'pos_graad',
				'pos_naamval',
				'pos_positie'
			]
		},
		bw: {
			value: 'bw',
			displayName: 'BW',
			subAnnotationIds: [
				// 'bwtype',
				'pos_pdtype',
				'pos_status'
			]
		},
		vz: {
			value: 'vz',
			displayName: 'VZ',
			subAnnotationIds: [
				'pos_vztype'
			]
		},
		ww: {
			value: 'ww',
			displayName: 'WW',
			subAnnotationIds: [
				'pos_buiging',
				'pos_getal-n',
				'pos_positie',
				'pos_pvagr',
				'pos_pvtijd',
				'pos_wvorm'
			]
		},
		vnw: {
			value: 'vnw',
			displayName: 'VNW',
			subAnnotationIds: [
				'pos_buiging',
				'pos_genus',
				'pos_getal',
				'pos_getal-n',
				'pos_graad',
				'pos_naamval',
				'pos_npagr',
				'pos_pdtype',
				'pos_persoon',
				'pos_positie',
				'pos_status',
				'pos_vwtype'
			]
		},
		spec: {
			value: 'spec',
			displayName: 'SPEC',
			subAnnotationIds: [
				'pos_spectype'
			]
		}
	},
	subAnnotations: {
		'pos_lwtype': {
			id: 'pos_lwtype',
			displayName: 'pos_lwtype',
			values: [
				{
					value: 'bep',
					displayName: 'bep'
				},
				{
					value: 'onbep',
					displayName: 'onbep'
				}
			]
		},
		'pos_vztype': {
			id: 'pos_vztype',
			displayName: 'pos_vztype',
			values: [
				{
					value: 'fin',
					displayName: 'fin'
				},
				{
					value: 'init',
					displayName: 'init'
				},
				{
					value: 'versm',
					displayName: 'versm'
				}
			]
		},
		'pos_pdtype': {
			id: 'pos_pdtype',
			displayName: 'pos_pdtype',
			values: [
				{
					value: 'adv-pron',
					displayName: 'adv-pron'
				},
				{
					value: 'det',
					displayName: 'det'
				},
				{
					value: 'grad',
					displayName: 'grad'
				},
				{
					value: 'pron',
					displayName: 'pron'
				}
			]
		},
		'pos_graad': {
			id: 'pos_graad',
			displayName: 'pos_graad',
			values: [
				{
					value: 'basis',
					displayName: 'basis'
				},
				{
					value: 'comp',
					displayName: 'comp'
				},
				{
					value: 'dim',
					displayName: 'dim'
				},
				{
					value: 'sup',
					displayName: 'sup'
				}
			]
		},
		'pos_numtype': {
			id: 'pos_numtype',
			displayName: 'pos_numtype',
			values: [
				{
					value: 'hoofd',
					displayName: 'hoofd'
				},
				{
					value: 'onbep',
					displayName: 'onbep'
				},
				{
					value: 'rang',
					displayName: 'rang'
				}
			]
		},
		'pos_vwtype': {
			id: 'pos_vwtype',
			displayName: 'pos_vwtype',
			values: [
				{
					value: 'aanw',
					displayName: 'aanw'
				},
				{
					value: 'betr',
					displayName: 'betr'
				},
				{
					value: 'bez',
					displayName: 'bez'
				},
				{
					value: 'excl',
					displayName: 'excl'
				},
				{
					value: 'onbep',
					displayName: 'onbep'
				},
				{
					value: 'pers',
					displayName: 'pers'
				},
				{
					value: 'pr',
					displayName: 'pr'
				},
				{
					value: 'recip',
					displayName: 'recip'
				},
				{
					value: 'refl',
					displayName: 'refl'
				},
				{
					value: 'vb',
					displayName: 'vb'
				},
				{
					value: 'vrag',
					displayName: 'vrag'
				}
			]
		},
		'pos_positie': {
			id: 'pos_positie',
			displayName: 'pos_positie',
			values: [
				{
					value: 'nom',
					displayName: 'nom'
				},
				{
					value: 'postnom',
					displayName: 'postnom'
				},
				{
					value: 'prenom',
					displayName: 'prenom'
				},
				{
					value: 'vrij',
					displayName: 'vrij'
				}
			]
		},
		'pos_pvagr': {
			id: 'pos_pvagr',
			displayName: 'pos_pvagr',
			values: [
				{
					value: 'ev',
					displayName: 'ev'
				},
				{
					value: 'met-t',
					displayName: 'met-t'
				},
				{
					value: 'mv',
					displayName: 'mv'
				}
			]
		},
		// 'bwtype': {
		// 	id: 'bwtype',
		// 	displayName: 'bwtype',
		// 	values: [
		// 		{
		// 			value: 'aanw',
		// 			displayName: 'aanw'
		// 		},
		// 		{
		// 			value: 'alg',
		// 			displayName: 'alg'
		// 		},
		// 		{
		// 			value: 'betr',
		// 			displayName: 'betr'
		// 		},
		// 		{
		// 			value: 'herv',
		// 			displayName: 'herv'
		// 		},
		// 		{
		// 			value: 'neg',
		// 			displayName: 'neg'
		// 		},
		// 		{
		// 			value: 'onbep',
		// 			displayName: 'onbep'
		// 		},
		// 		{
		// 			value: 'vrag',
		// 			displayName: 'vrag'
		// 		}
		// 	]
		// },
		'pos_wvorm': {
			id: 'pos_wvorm',
			displayName: 'pos_wvorm',
			values: [
				{
					value: 'inf',
					displayName: 'inf'
				},
				{
					value: 'od',
					displayName: 'od'
				},
				{
					value: 'part',
					displayName: 'part'
				},
				{
					value: 'pv',
					displayName: 'pv'
				},
				{
					value: 'vd',
					displayName: 'vd'
				}
			]
		},
		'pos_getal': {
			id: 'pos_getal',
			displayName: 'pos_getal',
			values: [
				{
					value: 'ev',
					displayName: 'ev'
				},
				{
					value: 'mv',
					displayName: 'mv'
				}
			]
		},
		'pos_npagr': {
			id: 'pos_npagr',
			displayName: 'pos_npagr',
			values: [
				{
					value: 'agr',
					displayName: 'agr'
				},
				{
					value: 'agr3',
					displayName: 'agr3'
				},
				{
					value: 'evf',
					displayName: 'evf'
				},
				{
					value: 'evmo',
					displayName: 'evmo'
				},
				{
					value: 'evon',
					displayName: 'evon'
				},
				{
					value: 'evz',
					displayName: 'evz'
				},
				{
					value: 'mv',
					displayName: 'mv'
				},
				{
					value: 'rest',
					displayName: 'rest'
				},
				{
					value: 'rest3',
					displayName: 'rest3'
				}
			]
		},
		'pos_naamval': {
			id: 'pos_naamval',
			displayName: 'pos_naamval',
			values: [
				{
					value: 'bijz',
					displayName: 'bijz'
				},
				{
					value: 'dat',
					displayName: 'dat'
				},
				{
					value: 'gen',
					displayName: 'gen'
				},
				{
					value: 'nomin',
					displayName: 'nomin'
				},
				{
					value: 'obl',
					displayName: 'obl'
				},
				{
					value: 'stan',
					displayName: 'stan'
				}
			]
		},
		// 'wwtype': {
		// 	id: 'wwtype',
		// 	displayName: 'wwtype',
		// 	values: [
		// 		{
		// 			value: 'hoofd',
		// 			displayName: 'hoofd'
		// 		},
		// 		{
		// 			value: 'hulp-of-koppel',
		// 			displayName: 'hulp-of-koppel'
		// 		}
		// 	]
		// },
		'pos_genus': {
			id: 'pos_genus',
			displayName: 'pos_genus',
			values: [
				{
					value: 'fem',
					displayName: 'fem'
				},
				{
					value: 'pos_genus',
					displayName: 'pos_genus'
				},
				{
					value: 'masc',
					displayName: 'masc'
				},
				{
					value: 'onz',
					displayName: 'onz'
				},
				{
					value: 'zijd',
					displayName: 'zijd'
				}
			]
		},
		'pos_ntype': {
			id: 'pos_ntype',
			displayName: 'pos_ntype',
			values: [
				{
					value: 'eigen',
					displayName: 'eigen'
				},
				{
					value: 'soort',
					displayName: 'soort'
				}
			]
		},
		'pos_status': {
			id: 'pos_status',
			displayName: 'pos_status',
			values: [
				{
					value: 'ellips',
					displayName: 'ellips'
				},
				{
					value: 'nadr',
					displayName: 'nadr'
				},
				{
					value: 'red',
					displayName: 'red'
				},
				{
					value: 'vol',
					displayName: 'vol'
				}
			]
		},
		// 'variatie': {
		// 	id: 'variatie',
		// 	displayName: 'variatie',
		// 	values: [
		// 		{
		// 			value: 'pos_dial',
		// 			displayName: 'pos_dial'
		// 		}
		// 	]
		// },
		'pos_persoon': {
			id: 'pos_persoon',
			displayName: 'pos_persoon',
			values: [
				{
					value: '1',
					displayName: '1'
				},
				{
					value: '2',
					displayName: '2'
				},
				{
					value: '2b',
					displayName: '2b'
				},
				{
					value: '2v',
					displayName: '2v'
				},
				{
					value: '3',
					displayName: '3'
				},
				{
					value: '3m',
					displayName: '3m'
				},
				{
					value: '3o',
					displayName: '3o'
				},
				{
					value: '3p',
					displayName: '3p'
				},
				{
					value: '3v',
					displayName: '3v'
				}
			]
		},
		'pos_getal-n': {
			id: 'pos_getal-n',
			displayName: 'pos_getal-n',
			values: [
				{
					value: 'ev-n',
					displayName: 'ev-n'
				},
				{
					value: 'mv-n',
					displayName: 'mv-n'
				},
				{
					value: 'zonder-n',
					displayName: 'zonder-n'
				}
			]
		},
		'pos_conjtype': {
			id: 'pos_conjtype',
			displayName: 'pos_conjtype',
			values: [
				{
					value: 'neven',
					displayName: 'neven'
				},
				{
					value: 'onder',
					displayName: 'onder'
				}
			]
		},
		'pos_buiging': {
			id: 'pos_buiging',
			displayName: 'pos_buiging',
			values: [
				{
					value: 'met-e',
					displayName: 'met-e'
				},
				{
					value: 'met-n',
					displayName: 'met-n'
				},
				{
					value: 'met-s',
					displayName: 'met-s'
				},
				{
					value: 'met-t',
					displayName: 'met-t'
				},
				{
					value: 'overig',
					displayName: 'overig'
				},
				{
					value: 'zonder',
					displayName: 'zonder'
				}
			]
		},
		'pos_spectype': {
			id: 'pos_spectype',
			displayName: 'pos_spectype',
			values: [
				{
					value: 'afgebr',
					displayName: 'afgebr'
				},
				{
					value: 'afk',
					displayName: 'afk'
				},
				{
					value: 'deeleigen',
					displayName: 'deeleigen'
				},
				{
					value: 'meta',
					displayName: 'meta'
				},
				{
					value: 'onverst',
					displayName: 'onverst'
				},
				{
					value: 'overig',
					displayName: 'overig'
				},
				{
					value: 'symb',
					displayName: 'symb'
				},
				{
					value: 'vreemd',
					displayName: 'vreemd'
				}
			]
		},
		'pos_pvtijd': {
			id: 'pos_pvtijd',
			displayName: 'pos_pvtijd',
			values: [
				{
					value: 'conj',
					displayName: 'conj'
				},
				{
					value: 'imp',
					displayName: 'imp'
				},
				{
					value: 'imper',
					displayName: 'imper'
				},
				{
					value: 'tgw',
					displayName: 'tgw'
				},
				{
					value: 'verl',
					displayName: 'verl'
				}
			]
		},
		// 'deel': {
		// 	id: 'deel',
		// 	displayName: 'deel',
		// 	values: [
		// 		{
		// 			value: 'bw-deel-ww',
		// 			displayName: 'bw-deel-ww'
		// 		},
		// 		{
		// 			value: 'deel',
		// 			displayName: 'deel'
		// 		},
		// 		{
		// 			value: 'deel-b',
		// 			displayName: 'deel-b'
		// 		},
		// 		{
		// 			value: 'deel-f',
		// 			displayName: 'deel-f'
		// 		},
		// 		{
		// 			value: 'deel-i',
		// 			displayName: 'deel-i'
		// 		},
		// 		{
		// 			value: 'hoofddeel-bw',
		// 			displayName: 'hoofddeel-bw'
		// 		},
		// 		{
		// 			value: 'hoofddeel-ww',
		// 			displayName: 'hoofddeel-ww'
		// 		},
		// 		{
		// 			value: 'vz-deel-bw',
		// 			displayName: 'vz-deel-bw'
		// 		}
		// 	]
		// }
	}
};

import {NormalizedAnnotation} from '@/types/apptypes';
import * as CorpusStore from '@/store/corpus';

/** check if all annotations and their values exist */
export function validateTagset(annotation: NormalizedAnnotation, t: NormalizedTagset) {
	const validAnnotations = CorpusStore.get.annotations().reduce((acc, a) => {
		acc[a.id] = a;
		return acc;
	}, {} as {[id: string]: NormalizedAnnotation});

	function validateAnnotation(id: string, values: string[]) {
		const mainAnnotation = validAnnotations[id];
		if (!mainAnnotation) {
			throw new Error('Annotation ' + id + ' does not exist in corpus');
		}

		if (!mainAnnotation.values) {
			throw new Error('Annotation ' + id + ' does not have any known values');
		}

		values.forEach(v => {
			if (mainAnnotation.values!.findIndex(mav => mav.value === v) === -1) {
				// tslint:disable-next-line
				console.warn('Annotation ' + id + ' may have value ' + v + ' which does not exist in the corpus.');
			}
		});
	}

	validateAnnotation(annotation.id, Object.keys(t.values));
	Object.values(t.subAnnotations).forEach(sub => {
		validateAnnotation(sub.id, sub.values.map(v => v.value));
	});

	Object.values(t.values).forEach(({value, subAnnotationIds}) => {
		subAnnotationIds = subAnnotationIds.filter(subId => validAnnotations[subId] == null);
		if (subAnnotationIds.length) {
			throw new Error('Value ' + value + ' declares subAnnotation(s) ' + subAnnotationIds + ' that do not exist in the corpus');
		}
	});
}
