<template>
	<component :is="tag" v-if="html" :style="{fontWeight: bold ? 'bold' : undefined}">
		<template v-for="token in data">
			<span
				v-html="token.text"
				:style="{boxShadow: token.captureAndRelation && token.captureAndRelation.length && `0 0 0 2px ${token.captureAndRelation[0].color}`}"
				:title="token.captureAndRelation && token.captureAndRelation.length && token.captureAndRelation[0].key"
			></span>
			<span v-html="token.punct"></span>
		</template>
	</component>
	<component v-else :is="tag" :style="{fontWeight: bold ? 'bold' : undefined}">
		<template v-for="token in data">
			<template v-if="token.captureAndRelation">
				<span
					:style="{boxShadow: token.captureAndRelation && token.captureAndRelation.length && `0 0 0 2px ${token.captureAndRelation[0].color}`}"
					:title="token.captureAndRelation && token.captureAndRelation.length && token.captureAndRelation[0].key"
				>{{ token.text }}</span>
			</template>
			<template v-else>{{ token.text }}</template>
			{{token.punct}}
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

