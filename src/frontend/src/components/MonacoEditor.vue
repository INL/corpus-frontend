<template>
	<div style="min-height: 200px;">
		<div ref="editor" style="width: 100%; height: calc(100% - 1.5em);"></div>
		<label><input type=checkbox v-model="darkmode"> Dark mode</label>
	</div>
</template>

<script lang="ts">
import Vue from 'vue';

import * as monaco from 'monaco-editor';
import { configureMonacoYaml } from 'monaco-yaml';
import type {JSONSchema7} from 'json-schema';
import blfschema from '@/assets/blf-schema.json';

configureMonacoYaml(monaco, {
	enableSchemaRequest: false,
	schemas: [{
		fileMatch: ['*'],

		// @ts-ignore
		schema: blfschema as JSONSchema7,
		uri: new URL('@/assets/blf-schema.json', import.meta.url).toString(),
		// JSON.stringify(blfschema),
		// uri: 'https://github.com/remcohaszing/monaco-yaml#usage'
	}],
});

monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
	validate: true,
	schemas: [{
		uri: new URL('@/assets/blf-schema.json', import.meta.url).toString(),
		fileMatch: ['*'],
		schema: blfschema
	}],
	allowComments: true,
});

window.MonacoEnvironment = {
	getWorker(moduleId, label) {
		switch (label) {
		case 'editorWorkerService':
			return new Worker(new URL('monaco-editor/esm/vs/editor/editor.worker', import.meta.url))
		case 'css':
		case 'less':
		case 'scss':
			return new Worker(new URL('monaco-editor/esm/vs/language/css/css.worker', import.meta.url))
		case 'handlebars':
		case 'html':
		case 'razor':
			return new Worker(new URL('monaco-editor/esm/vs/language/html/html.worker', import.meta.url))
		case 'javascript':
		case 'typescript':
			return new Worker(new URL('monaco-editor/esm/vs/language/typescript/ts.worker', import.meta.url))
		case 'json':
			return new Worker(new URL('monaco-editor/esm/vs/language/json/json.worker', import.meta.url))
		case 'yaml':
			return new Worker(new URL('monaco-yaml/yaml.worker', import.meta.url))
		default:
			throw new Error(`Unknown label ${label}`)
		}
	}
}

export default Vue.extend({
	props: {
		value: String,
		language: { default: 'text' },
		filename: { default: 'file.text' },
		options: Object as () => monaco.editor.IStandaloneEditorConstructionOptions
	},
	data: () => ({
		editor: null as any as monaco.editor.IStandaloneCodeEditor,
		emittedValue: '',
		// get system property
		darkmode: window.matchMedia('(prefers-color-scheme: dark)').matches,
	}),
	computed: {
		effectiveOptions(): monaco.editor.IStandaloneEditorConstructionOptions {
			return { theme: this.darkmode ? 'vs-dark' : 'vs', ...this.options, };
		}
	},
	methods: {
		/** Name should include the language as extension. The language is supplied separately to enable highlighting. */
		createOrUpdateEditor(contents: string, name: string, language: string) {
			const newUri = monaco.Uri.file(name);
			let newModel = monaco.editor.getModels().find(m => m.uri.path === newUri.path);
			if (newModel) newModel.setValue(contents);
			else newModel = monaco.editor.createModel(contents, language, newUri);

			if (this.editor)
				this.editor.setModel(newModel);
			return newModel;
		},
		updateValue(newValue: string) { if (this.editor) this.editor.setValue(newValue); },
		updateFileName(newName: string) { if (this.editor) this.createOrUpdateEditor(this.editor.getValue(), newName, this.language); },
		updateLanguage(newLang: string) { if (this.editor) monaco.editor.setModelLanguage(this.editor.getModel()!, newLang); },
		updateOptions(newOptions: monaco.editor.IStandaloneEditorConstructionOptions) { if (this.editor) this.editor.updateOptions(newOptions); }
	},
	mounted() {
		this.editor = monaco.editor.create(this.$refs.editor as HTMLElement, {
			model: this.createOrUpdateEditor(this.value, this.filename, this.language),
			...this.effectiveOptions
		});
		this.editor.onDidChangeModelContent(() => {
			this.emittedValue = this.editor.getValue();
			this.$emit('input', this.emittedValue);
		});
	},

	watch: {
		// Assume a reference comparison is made first
		// https://stackoverflow.com/questions/23836825/is-javascript-string-comparison-just-as-fast-as-number-comparison
		// So long models *should* be okay, as long as vue doesn't copy the emitted input event string internally.
		value(newVal: string) {  if (newVal !== this.emittedValue) this.editor.setValue(newVal); },
		language(newVal: string) { this.updateLanguage(newVal); },
		// if this changes we need to recreate the model unfortunately
		filename(newVal: string) { this.updateFileName(newVal); },
		effectiveOptions: { deep: true, handler(newVal: monaco.editor.IStandaloneEditorConstructionOptions) { this.updateOptions(newVal); } }
	},
	beforeDestroy() {
		if (this.editor) this.editor.dispose();
		// @ts-ignore
		this.editor = null;
	}
});


</script>