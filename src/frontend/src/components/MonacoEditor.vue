<template>
	<div ref="editor" min-height="200px;"></div>
</template>

<script lang="ts">
import * as monaco from 'monaco-editor';
import Vue from 'vue';

const changeTrackSymbol = Symbol('changeTrack');

export default Vue.extend({
	props: {
		value: String,
		options: Object as () => monaco.editor.IStandaloneEditorConstructionOptions
	},
	data: () => ({
		editor: null as any as monaco.editor.IStandaloneCodeEditor,
		emittedValue: '',
		language: 'text',
	}),
	mounted() {
		this.editor = monaco.editor.create(this.$refs.editor as HTMLElement, {
			value: this.value,
			language: this.language,
			...this.options
		});
		this.editor.onDidChangeModelContent(() => {
			this.emittedValue = this.editor.getValue();
			this.$emit('input', this.emittedValue);
		});
		this.language = this.options.language || this.language;
	},
	watch: {
		value(newVal: string) {
			// just going to assume that the browser will optimize this and first check reference equality
			// otherwise we'd be in a bit of pain for very long strings
			if (newVal !== this.emittedValue)
				this.editor.setValue(newVal);
		},
		options: {
			deep: true,
			handler(newVal: monaco.editor.IStandaloneEditorConstructionOptions) {
				this.editor.updateOptions(newVal);
				if (this.options.language && this.language !== this.options.language)
					monaco.editor.setModelLanguage(this.editor!.getModel()!, this.language = this.options.language);
			}
		}
	},
});


</script>