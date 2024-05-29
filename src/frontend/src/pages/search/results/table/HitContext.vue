<template>
	<!-- mind the whitespace, we don't want ANY whitespace between elements. -->
	<component :is="tag" v-if="html" :style="{fontWeight: bold ? 'bold' : undefined}"
		><template v-if="before">…</template
		><template v-for="{text, punct, style, title}, i in renderInfo"
			><span v-if="style"
				v-html="text"
				:key="text + '_' + title + '_' + i"
				:style="style"
				:title="title"
			></span
			><span v-else v-html="text" :key="text + '_' + i"></span
			><span v-if="doPunct" v-html="punct" :key="punct + '_' + i"></span
		></template
		><template v-if="after">…</template
	></component
	><component v-else :is="tag" :style="{fontWeight: bold ? 'bold' : undefined}"
		><template v-if="before">…</template
		><template v-for="{text, punct, style, title}, i in renderInfo"
			><span v-if="style"
				:key="text + '_' + title + '_' + i"
				:style="style"
				:title="title"
			>{{ text }}</span
			><template v-else>{{ text }}</template
			><template v-if="doPunct">{{punct}}</template
		></template
		><template v-if="after">…</template
	></component>
</template>

<script lang="ts">
import Vue from 'vue';
import { HitContext } from '@/types/apptypes';

export default Vue.extend({
	props: {
		data: Object as () => HitContext,
		html: Boolean,
		tag: {
			default: 'div',
			required: false,
			type: String as () => keyof HTMLElementTagNameMap
		},
		bold: Boolean,
		highlight: {default: true},

		before: Boolean,
		after: Boolean,
		punct: {default: true},
		/** If set, render one of the values in HitToken.annotation, instead of the main 'text' property of the HitToken */
		annotation: String,

	},
	computed: {
		doPunct(): boolean { return this.punct; }, // avoid conflict with props.data in template
		renderInfo(): Array<{text: string, punct: string, style?: object, title?: string}> {
			const tokens = this.before ? this.data.before : this.after ? this.data.after : this.data.match;
			return tokens.map(token => ({
				text: this.annotation ? token.annotations[this.annotation] : token.text,
				punct: token.punct,
				title: this.highlight ? token.captureAndRelation?.map(c => c.key).join(', ') : undefined,
				style: this.highlight && token.captureAndRelation?.length ? {
					background: `linear-gradient(90deg, ${token.captureAndRelation.map((c, i) => `${c.color} ${i / token.captureAndRelation!.length * 100}%, ${c.color} ${(i + 1) / token.captureAndRelation!.length * 100}%`)})`,
					display: 'inline-block',
					color: token.captureAndRelation[0].textcolor,
					'border-radius': '2px',
					padding: '0 2px',
					textShadow: `0 0 1.25px ${token.captureAndRelation[0].textcolorcontrast},`.repeat(10).replace(/,$/, '')
				} : undefined
			}));
		}
	},
});
</script>

