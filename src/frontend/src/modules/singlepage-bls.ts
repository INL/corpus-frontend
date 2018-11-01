import {getState, get} from '@/store';
import {getFilterString} from '@/utils';

import * as BLTypes from '@/types/blacklabtypes';

/** Converts page state into a query for blacklab-server. */
export function getBlsParamFromState(): BLTypes.BLSearchParameters {
	const state = getState();

	const viewProps = get.viewedResultsSettings();
	if (viewProps == null) {
		throw new Error('Cannot generate blacklab parameters without knowing hits or docs');
	}

	const submittedParameters = state.form.submittedParameters;
	if (submittedParameters == null) {
		// Realistically we can... because we can use the current state of the ui
		// but this should never happen before the form is submitted, or after it has been cleared
		throw new Error('Cannot generate blacklab parameters before search form has been submitted');
	}

	return {
		filter: getFilterString(submittedParameters.filters),
		first: state.settings.pageSize * viewProps.page,
		group: viewProps.groupBy.map(g => g + (viewProps.caseSensitive ? ':s':':i')).join(',') || undefined,
		// group: viewProps.groupBy.join(',') || undefined,
		number: state.settings.pageSize,
		patt: submittedParameters.pattern||undefined,

		sample: (state.settings.sampleMode === 'percentage' && state.settings.sampleSize) ? state.settings.sampleSize /* can't be null after check */ : undefined,
		samplenum: (state.settings.sampleMode === 'count' && state.settings.sampleSize) ? state.settings.sampleSize : undefined,
		sampleseed: (state.settings.sampleSeed != null && state.settings.sampleMode && state.settings.sampleSize) ? state.settings.sampleSeed : undefined,

		sort: viewProps.sort != null ? viewProps.sort : undefined,
		viewgroup: viewProps.viewGroup != null ? viewProps.viewGroup : undefined,
		wordsaroundhit: state.settings.wordsAroundHit != null ? state.settings.wordsAroundHit : undefined,
	};
}
