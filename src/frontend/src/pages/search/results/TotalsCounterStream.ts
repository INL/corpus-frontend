import { ReplaySubject, Observable, pipe, of } from 'rxjs';
import { switchMap, map, expand, tap } from 'rxjs/operators';

import * as Api from '@/api';

import * as BLTypes from '@/types/blacklabtypes';

export type CounterInput = {
	indexId: string;
	operation: 'hits'|'docs';
	results: BLTypes.BLSearchResult;
};

export type CounterOutput = {
	state: 'counting'|'paused'|'finished'|'limited',
	results: BLTypes.BLSearchResult;
};

type CounterInternal = CounterInput & CounterOutput;

function getCountState(results: BLTypes.BLSearchResult): 'limited'|'finished'|'counting' {
	const isLimited = BLTypes.isHitGroupsOrResults(results) && results.summary.stoppedCountingHits;
	const isFinished = !results.summary.stillCounting;
	return (
		isLimited ? 'limited' :
		isFinished ? 'finished' :
		'counting'
	);
}

const REFRESH_INTERVAL = 2_000;
const REFRESH_DURATION = 30_000;

export default pipe(
	switchMap((initial: CounterInput) => {
		return new Observable<CounterOutput>(subscriber => {
			let unsubscribed = false;
			let hitTimeout = false;
			let timeoutHandle: number|null = setTimeout(() => {
				hitTimeout = true;
				timeoutHandle = null;
			}, REFRESH_DURATION);

			let cancel: Api.Canceler|null = null;
			function teardown() {
				unsubscribed = true;
				if (cancel != null) {
					cancel();
				}
			}

			of(initial)
			.pipe(
				map((input: CounterInput): CounterInternal => ({
					indexId: input.indexId,
					operation: input.operation,
					results: input.results,
					state: getCountState(input.results)
				})),
				expand((cur: CounterInternal) => {
					/*
						We can't use async here as we would always return a promise
						which - even if empty - is transformed into a single undefined value
						which in turn would be fed back into expand, causing an infinite loop

						So instead just return a stream we can control ourselves, so we can yield the value asynchronously
						allowing us to wait for the response, handle cancellation, etc.
					*/
					const values$ = new ReplaySubject<CounterInternal>(1);
					const {indexId, operation, results: oldResults, state} = cur;

					if (state !== 'counting' || unsubscribed) {
						if (timeoutHandle != null) {
							clearTimeout(timeoutHandle);
							timeoutHandle = null;
						}

						values$.complete();
						return values$;
					}

					// Delay for a second so we don't pummel the server with rapid requests if we don't need to
					// Do this through a simple timeout so we don't have to nest so many streams
					new Promise(resolve => setTimeout(resolve, REFRESH_INTERVAL))
					.then((): Promise<BLTypes.BLSearchResult> => {
						const apiCall = operation === 'docs' ? Api.blacklab.getDocs : Api.blacklab.getHits;
						const apiResult = apiCall(indexId, {
							...oldResults.summary.searchParam,
							number: 0,
							first: 0
						}, {
							headers: { 'Cache-Control': 'no-cache' }
						});

						cancel = apiResult.cancel;
						return apiResult.request;
					})
					.then((results: BLTypes.BLSearchResult) => {
						values$.next({
							indexId,
							operation,
							results,
							state: hitTimeout ? 'paused' : getCountState(results)
						});
					})
					.catch((e: Api.ApiError) => {
						if (e.title !== 'Request cancelled') {
							values$.error(e);
						}
					})
					.finally(() => values$.complete());

					return values$;
				}),
				map((result: CounterInternal): CounterOutput => ({
					results: result.results,
					state: result.state
				}))
			).subscribe(subscriber);

			// This is the teardown for the top-level switchmap
			// it should ensure the recursive expand operator quits on its next iteration
			// and tear down any async work that might have been started by the last iteration
			return teardown;
		});
	})
);
