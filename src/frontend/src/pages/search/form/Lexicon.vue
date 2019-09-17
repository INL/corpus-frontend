<template>
	<div style="position: relative;">
		<input
			type="text"
			:class="{'form-control': true, 'loading': !posOptions || !wordOptions}"
			autocomplete="off"

			:id="inputId"
			:name="inputId"
			:placeholder="definition.displayName"
			:disabled="!!displayLexiconValue"

			:value="displayLexiconValue ? displayLexiconValue : displayValue"
			@input="displayValue = $event.target.value; input$.next($event.target.value);"
		/>
		<span v-if="!wordOptions" class="fa fa-spinner fa-spin text-muted"></span>

		<br>
		<label v-for="opt in renderedWords" :key="opt.id"
			style="width: 10vw; min-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
			:role="opt.count > 0 ? 'button' : undefined"
			:class="{'disabled': opt.count === 0}"
			:title="`${opt.word} (${opt.count})`"
		>
			<input type="checkbox"
				:value="opt"
				:disabled="opt.count === 0"

				v-model="opt.selected"
			> {{opt.word}}<!-- ({{opt.count}})-->
		</label>
		<template v-if="wordOptions && wordOptions.length"> <!-- if we have wordOptions, we also have pos options -->
			<h4>Limit to Part of Speech</h4>
			<label v-for="(checked, pos) in posOptions" :key="pos"
				style="width: 10vw; min-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
				role="button"
			>
				<input type="checkbox"
					v-model="posOptions[pos]"
					:value="pos"
				> {{pos}}
			</label>
		</template>
		<template v-if="wordOptions && wordOptions.length">
			<br><br>
			<button
				type="button"
				class="btn btn-default"
				:disabled="selectedWords.length === renderedWords.length"
				@click="renderedWords.forEach(w => w.selected = w.count > 0)">Select all
			</button>
			<button
				type="button"
				class="btn btn-default"
				:disabled="!selectedWords.length"
				@click="renderedWords.forEach(w => w.selected = false)">Deselect all
			</button>
		</template>
	</div>
</template>

<script lang="ts">
import Vue from 'vue';
import Axios from 'axios';
import * as Observable from 'rxjs';
import { debounceTime, switchMap, flatMap, map, toArray, catchError, mapTo, distinctUntilChanged, tap } from 'rxjs/operators';

import * as CorpusStore from '@/store/search/corpus';
import * as api from '@/api';
import SelectPicker, { Option } from '@/components/SelectPicker.vue';
import UID from '@/mixins/uid';
import { escapeRegex, filterDuplicates, MapOf, mapReduce, getAnnotationPatternString } from '@/utils';

type LexiconParams = {
	database: string;
	lemma: string;
	case_sensitive: boolean;
	/** only one pos per query supported */
	pos?: string;
	/** Return split part of speech tags in the lexicon service? */
	split?: boolean;

	dataset?: string;
	year_from?: string; // format to be determined (just yyyy?)
	year_to?: string;
	tweaked_queries?: boolean;
	lemma_provenance?: string;
	paradigm_provenance?: any; // not sure what this is?
};

type LexiconLemmaIdResponse = {
	message: 'OK';
	lemmata_list: Array<{
		found_lemmata: Array<{
			lemma: string;
			lemma_id: string;
			pos: string;
		}>;
	}>;
};

type LexiconWordformsResponse = {
	message: 'OK';
	wordforms_list: Array<{
		found_wordforms: string[];
	}>;
};

const config = {
	lexiconUrl1: `http://sk.taalbanknederlands.inl.nl/LexiconService/lexicon/get_lemma_id_from_lemma`,
	lexiconUrl2: `http://sk.taalbanknederlands.inl.nl/LexiconService/lexicon/get_wordforms_from_lemma_id`,
	database: `mnwlex`,
	case_sensitive: false,
};

type WordOption = {
	lemma: string;
	pos: string[];
	count: number;
	word: string;
	// id: string;
	selected: boolean;
};

export default Vue.extend({
	mixins: [UID],
	components: { SelectPicker },
	props: {
		annotationId: String,
		value: null as any as () => null|string,
		definition: Object as () => any
	},
	data: () => ({
		input$: new Observable.BehaviorSubject<string>(''),
		subscriptions: [] as Observable.Subscription[],

		wordOptions: [] as null|WordOption[],
		// selectedWordOptions: [] as WordOption[],

		posOptions: {} as MapOf<boolean>,

		displayValue: '',
	}),
	computed: {
		cql(): string|undefined {
			if (this.selectedWords.length) {
				// return this.selectedWords.map(w => escapeRegex(w.word, false).replace(/"/g, '\\"')).join('|');
				const joined = this.selectedWords.map(w => w.word).join('|').replace(/"/g, '\\"');
				return joined.match(/\s+/) ? `"${joined}"` : joined;
			}
			return this.displayValue.trim() || undefined;
		},
		displayLexiconValue(): string|null { return this.selectedWords.map(w => w.word).join('|') || null; },
		inputId(): string { return this.definition.id + '_' + (this as any).uid; },

		selectedWords(): WordOption[] { return this.renderedWords ? this.renderedWords.filter(w => w.selected) : []; },
		renderedWords(): WordOption[] { return this.wordOptions ? this.wordOptions.filter(w => w.pos.some(pos => this.posOptions[pos])) : []; },
	},
	created() {
		const emptyResult = {posOptions: {} as MapOf<boolean>, wordList: [] as WordOption[]};
		const suggestions$: Observable.Observable<typeof emptyResult> = this.input$.pipe(
			debounceTime(1500),
			switchMap(term => {
				if (!term) {
					return Observable.of(emptyResult);
				}

				// Phase 1: get lemmata and their wordforms from the lexicon using the entered text
				const lemmataRequest = Axios.get<LexiconLemmaIdResponse>(config.lexiconUrl1, {
					params: {
						database: config.database,
						lemma: term,
						case_sensitive: config.case_sensitive
					},
				})
				.then(response => response.data.lemmata_list.flatMap(l => l.found_lemmata));
				// .then(r => new Promise<typeof r>((resolve) => setTimeout(() => resolve(r), 10000)));

				// Do this inside an observable, the pending stages of pipe() will not be ran if this observable is old (e.g. a new lemma came in)
				// Whereas if we .then().then().then() chain a promise, it will all run regardless of whether the results are still needed.
				return Observable
				.from(lemmataRequest)
				.pipe(
					// Phase 2: get associated words
					flatMap(lemmata => lemmata), // unpack the array of found lemmata into one message per lemma, for ease of use
					// Get the words that map to this lemma
					flatMap(lemma => Axios.get<LexiconWordformsResponse>(config.lexiconUrl2, {
						params: {
							database: config.database,
							lemma_id: lemma.lemma_id
						}
					}).then(response => ({...response.data, ...lemma}))),
					map(lemma => ({
						lemma: lemma.lemma,
						pos: lemma.pos,
						wordforms: lemma.message === 'OK' ? lemma.wordforms_list.flatMap(wfl => wfl.found_wordforms) : []
					})),

					// Phase 3: wait for all requests to the lexicon service to complete,
					// then coordinate with BlackLab to find out which of the found words actually exist in the corpus.
					toArray(),
					flatMap(async (lemmata) => {
						lemmata.forEach(l => l.pos = l.pos || '[unknown]');

						const {termFreq: frequencies} = await api.blacklab.getTermFrequencies(CorpusStore.getState().id, this.annotationId, lemmata.flatMap(r => r.wordforms));

						const options: MapOf<WordOption> = {};
						lemmata.forEach(({pos, wordforms, lemma}) => wordforms.forEach(word => {
							options[word] = options[word] || {
								lemma,
								pos: [],
								count: frequencies[word],
								word,
								selected: frequencies[word] > 0
							} as WordOption;
							options[word].pos.push(pos);
						}));

						const wordList = Object.values(options).filter(word => word.count > 0);
						const posOptions = mapReduce(lemmata, 'pos', l => true);
						return {posOptions, wordList};
					}),
					catchError(e => [emptyResult])
				);
			})
		);

		const results$ = Observable.merge(this.input$.pipe(mapTo(null)), suggestions$);

		this.subscriptions.push(
			results$.subscribe(r => {
				// this.selectedPosOptions = new Set<string>(r && r.posList ? r.posList : []);
				this.posOptions = r ? r.posOptions : {};
				this.wordOptions = r ? r.wordList.sort((a, b) => ((a.count === 0) !== (b.count === 0)) ? (a.count === 0 ? 1 : -1) : 0) : null;
			}),
		);

		this.displayValue = this.value || '';
	},
	destroyed() {
		this.subscriptions.forEach(s => s.unsubscribe());
	},
	watch: {
		// Watch for resets and clear the suggestions
		value(v: string) {
			// Hack! initialize the component's value
			if (!this.displayValue) {
				this.displayValue = v;
			}
			if (!v) {
				this.wordOptions = [];
				this.posOptions = {};
				this.displayValue = '';
			}
		},
		cql(v: string) {
			this.$emit('input', v);
		},
	}
});
</script>

<style lang="scss" scoped>

label[disabled],
label.disabled {
	opacity: 0.5;
	cursor: not-allowed;
	input {
		opacity: 1;
	}
}

.fa-spinner {
	position: absolute;
	right: 0;
	top: 0;
	font-size: 200%;
	padding: 0.33em;
	pointer-events: none;
}

.form-control.loading {
	text-overflow: ellipsis;
	padding-right: 2.5em;
}

</style>