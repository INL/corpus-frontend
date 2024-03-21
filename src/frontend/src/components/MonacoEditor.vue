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
		fileMatch: ['*.blf.*'],

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
		fileMatch: ['*.blf.*'],
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
		darkmode: true,
	}),
	computed: {
		effectiveOptions(): monaco.editor.IStandaloneEditorConstructionOptions {
			return {
				theme: this.darkmode ? 'vs-dark' : 'vs',
				...this.options,
			};
		}
	},
	mounted() {
		this.editor = monaco.editor.create(this.$refs.editor as HTMLElement, {
			model: monaco.editor.createModel(this.value, this.language, monaco.Uri.file(this.filename)),
			...this.effectiveOptions
		});
		this.editor.onDidChangeModelContent(() => {
			this.emittedValue = this.editor.getValue();
			this.$emit('input', this.emittedValue);
		});
	},
	watch: {
		value(newVal: string) {
			// Assume a reference comparison is made first
			// https://stackoverflow.com/questions/23836825/is-javascript-string-comparison-just-as-fast-as-number-comparison
			// So long models *should* be okay, as long as vue doesn't copy the emitted input event string internally.
			if (newVal !== this.emittedValue)
				this.editor.setValue(newVal);
		},
		language(newVal: string) {
			monaco.editor.setModelLanguage(this.editor.getModel()!, newVal);
		},
		// if this changes we need to recreate the model unfortunately
		filename(newVal: string) {
			// A model can only exist once, globally it seems.
			// The editor is really just a view on one of a set of models that are floating somewhere in global space.
			// So we need to take care that we don't create a new model with the same path.
			const newUri = monaco.Uri.file(newVal);
			monaco.editor.getModels().forEach(model => {
				if (model.uri.path === newUri.path)
					model.dispose();
			});
			this.editor.setModel(monaco.editor.createModel(this.value, this.language, monaco.Uri.file(newVal)));
		},
		effectiveOptions: {
			deep: true,
			handler(newVal: monaco.editor.IStandaloneEditorConstructionOptions) {
				this.editor.updateOptions(newVal);
			}
		}
	},
	beforeDestroy() {
		this.editor.dispose();
		// @ts-ignore
		this.editor = null;
	}
});


</script>