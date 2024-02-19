import Vue from 'vue';

export default class ConcordanceGetter<T> {
	public concordances: T[] = [];
	public loading = false;
	public error = null as string | null;
	public done = false;

	private cancelToken = null as null | (() => void);
	private request: Promise<T[]> | null = null;

	constructor(
		private readonly getter: (first: number, count: number) => {
			cancel: () => void;
			request: Promise<T[]>;
		},
		public totalCount: number,
		public pageSize: number = 20
	) {
		// make it so we can render this in a vue component reactively, etc.
		Vue.observable(this);
	}


	public next() {
		if (this.loading) {
			return;
		}

		const first = this.concordances.length;
		const count = Math.min(this.pageSize, this.totalCount - first);
		if (count <= 0) {
			return;
		}

		this.loading = true;
		const { request, cancel } = this.getter(first, count);
		this.cancelToken = cancel;
		this.request = request;
		this.request
			.then(r => { if (this.request === request) this.concordances.push(...r) })
			.catch(e => { if (this.request === request) this.error = e.toString(); })
			.finally(() => {
				if (this.request === request) {
					this.loading = false;
					this.cancelToken = this.request = null;
				}
				this.done = this.concordances.length >= this.totalCount;
			});
	}

	public cancel() {
		if (this.cancelToken) {
			this.cancelToken();
			this.cancelToken = null;
			this.request = null;
			this.loading = false;
		}
	}
}