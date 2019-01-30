import Vue from 'vue';
import * as Highcharts from 'highcharts';

import * as RootStore from '@/store/article';

import * as BLTypes from '@/types/blacklabtypes';
import { stripIndent } from 'common-tags';

export default Vue.extend({
	props: {
		snippet: Object as () => BLTypes.BLHitSnippet
	},
	computed: {
		growthAnnotations: RootStore.get.growthAnnotations,

		growth(): Highcharts.SeriesLineOptions[] {
			if (!this.growthAnnotations) {
				return [];
			}

			return this.growthAnnotations.annotations.map((annot): Highcharts.SeriesLineOptions => {
				let uniques = 0;
				const seen = {} as {[key: string]: boolean};

				const values = this.snippet.match[annot.id];
				const invLength = 100/values.length;

				return {
					type: 'line',
					name: annot.displayName,
					data: (() => {
						const ret = values.map((v, i) => ({
							name: v,
							x: i,
							x2: i * invLength,
							y: seen[v] ? uniques : (seen[v] = true, ++uniques),
							y2: 0
						}));

						const invUniques = 100/uniques;
						ret.forEach(v => (v.y2 = v.y*invUniques, v));
						return ret;
					})(),
				};
			});
		},

		chartOptions(): Highcharts.Options {
			return {
				title: {
					text: this.growthAnnotations ? this.growthAnnotations.displayName : ''
				},
				chart: {
					animation: false,
				},
				colors: (() => {
					const colors = [];
					const base = RootStore.get.baseColor();
					const numColors = Math.min(20, this.growthAnnotations ? this.growthAnnotations.annotations.length : 1);

					for(let i = 0; i < numColors; i += 1) {
						colors.push((Highcharts as any).Color(base).brighten(-0.4 + i / ((numColors+1) * 0.7)).get());
					}
					return colors;
				})(),
				tooltip: {
					animation: false,
					shadow: false,
					shared: false,
					useHTML: true,
					headerFormat: '<table class="table"><tbody>',
					pointFormat: stripIndent`
						<tr>
							<th colspan="3"><h3>{point.name} </h3></th>
						</tr>
						<tr>
							<th>Unique {series.name}: </th>
							<td> {point.y} </td>
							<td> ({point.y2:,.1f} %) </td>
						</tr>
						<tr>
							<th>Progress: </th>
							<td> {point.x} tokens </td>
							<td> ({point.x2:,.1f} %) </td>
						</tr>
					`,
					footerFormat: '</tbody></table>',
					followPointer: false
				},
				series: this.growth
			};
		}
	},
});
