<template>
	<component :is="tag" v-if="html" :style="{fontWeight: bold ? 'bold' : undefined}">
		<template v-for="({text, punct, captureAndRelation: cap}, i) in data">
			<span v-if="cap && cap.length"
				v-html="text"
				:key="text + '_' + cap[0].key + '_' + i"
				:style="{background: cap[0].color, display: 'inline-block', color: cap[0].textcolor, 'border-radius': '2px',}"
				:title="cap[0].key"
			></span>
			<span v-else v-html="text"></span>
			<span v-html="punct" :key="punct + '_' + i"></span>
		</template>
	</component>
	<component v-else :is="tag" :style="{fontWeight: bold ? 'bold' : undefined}">
		<template v-for="({text, punct, captureAndRelation: cap}, i) in data">
			<span v-if="cap && cap.length"
				:key="text + '_' + cap[0].key + '_' + i"
				:style="{background: cap[0].color, display: 'inline-block', color: cap[0].textcolor, 'border-radius': '2px', padding: '0 2px'}"
				:title="cap[0].key"
			>{{ text }}</span>
			<template v-else>{{ text }}</template>
			{{punct}}
		</template>
	</component>
</template>

<script lang="ts">
import Vue from 'vue';
import { HitToken } from '@/types/apptypes';

export default Vue.extend({
	props: {
		data: Array as () => HitToken[],
		html: Boolean,
		tag: {
			default: 'div',
			required: false,
			type: String as () => keyof HTMLElementTagNameMap
		},
		bold: Boolean
	},
});
</script>

