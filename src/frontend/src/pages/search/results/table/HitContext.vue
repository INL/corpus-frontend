<template>
	<!-- mind the whitespace, we don't want ANY whitespace between elements. -->
	<component :is="tag" v-if="html" :style="{fontWeight: bold ? 'bold' : undefined}"
		><template v-if="before">…</template
		><template v-for="({text, punct, captureAndRelation: cap}, i) in data"
			><span v-if="cap && cap.length"
				v-html="text"
				:key="text + '_' + cap[0].key + '_' + i"
				:style="{
					// let's create a gradient of all the captures.
					background: `linear-gradient(90deg, ${cap.map((c, i) => `${c.color} ${i / cap.length * 100}%, ${c.color} ${(i + 1) / cap.length * 100}%`)})`,
					// background: cap[0].color,
					display: 'inline-block',
					color: cap[0].textcolor,
					'border-radius': '2px',
					padding: '0 2px',
					textShadow: `0 0 1.25px ${cap[0].textcolorcontrast},`.repeat(10).replace(/,$/, '')
				}"
				:title="cap.map(c => c.key)"
			></span
			><span v-else v-html="text"></span
			><span v-if="doPunct" v-html="punct" :key="punct + '_' + i"></span
		></template
		><template v-if="after">…</template
	></component
	><component v-else :is="tag" :style="{fontWeight: bold ? 'bold' : undefined}"
		><template v-if="before">…</template
		><template v-for="({text, punct, captureAndRelation: cap}, i) in data"
			><span v-if="cap && cap.length"
				:key="text + '_' + cap[0].key + '_' + i"
				:style="{
					background: `linear-gradient(90deg, ${cap.map((c, i) => `${c.color} ${i / cap.length * 100}%, ${c.color} ${(i + 1) / cap.length * 100}%`)})`,
					display: 'inline-block',
					color: cap[0].textcolor,
					'border-radius': '2px',
					padding: '0 2px',
					textShadow: `0 0 1.25px ${cap[0].textcolorcontrast},`.repeat(10).replace(/,$/, '')
				}"
				:title="cap.map(c => c.key)"
			>{{ text }}</span
			><template v-else>{{ text }}</template
			><template v-if="doPunct">{{punct}}</template
		></template
		><template v-if="after"
		>…</template
	></component>
</template>

<script lang="ts">
import Vue from 'vue';
import { CaptureAndRelation, HitToken } from '@/types/apptypes';

export default Vue.extend({
	props: {
		data: Array as () => HitToken[],
		html: Boolean,
		tag: {
			default: 'div',
			required: false,
			type: String as () => keyof HTMLElementTagNameMap
		},
		bold: Boolean,

		before: Boolean,
		after: Boolean,
		punct: {default: true},
	},
	computed: {
		doPunct(): boolean { return this.punct; } // avoid conflict with props.data in template
	},
});
</script>

