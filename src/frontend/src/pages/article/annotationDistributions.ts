import Vue, {FunctionalComponentOptions} from 'vue';
import * as Highcharts from 'highcharts';

import * as RootStore from '@/store/article';

import * as BLTypes from '@/types/blacklabtypes';

export default Vue.extend({
	props: {
		snippet: Object as () => BLTypes.BLHitSnippet
	},
	computed: {
		distributionAnnotation: RootStore.get.distributionAnnotation,

		distribution(): Array<{
			y: number,
			name: string,
			color?: string
		}> {
			if (!this.distributionAnnotation) {
				return [];
			}

			const values = this.snippet.match[this.distributionAnnotation.id];
			const occurrances = values.reduce((acc, v) => (acc[v] = (acc[v] || 0) + 1, acc), {} as {[key: string]: number});
			return Object.entries(occurrances)
			.map(([key, count]) => ({
				y: count,
				name: key,
			}))
			.sort((a, b) => b.y - a.y);
		},

		chartOptions(): Highcharts.Options {
			return {
				title: {
					text: this.distributionAnnotation ? this.distributionAnnotation.displayName : ''
				},
				series: [{
					type: 'pie',
					data: this.distribution,
					allowPointSelect: true,
					animation: true,
					dataLabels: {
						format: '<b>{point.name}</b>: {point.percentage:.1f} %',
					},
					colors: (() => {
						const colors = [];
						const base = RootStore.get.baseColor();
						const numColors = Math.min(20, this.distribution.length);

						for (let i = 0; i < numColors; i += 1) {
							// Start out with a darkened base color (negative brighten), and end
							// up with a much brighter color
							colors.push((Highcharts as any).Color(base).brighten(-0.4 + i / ((numColors+1) * 0.7)).get());
						}
						return colors;
					})(),
				}] as Highcharts.SeriesPieOptions[],
				tooltip: {
					animation: false,
					pointFormat: '<span style="color:{point.color}">\u25CF</span> <b> {point.y:,.0f} ({point.percentage:.1f}%)</b>',
					shadow: false,
				}
			};
		}
	},
});
