<template>
	<div ref="editor" min-height="200px;"></div>
</template>

<script lang="ts">
import Vue from 'vue';

import * as monaco from 'monaco-editor';
import { configureMonacoYaml } from 'monaco-yaml';
// @ts-ignore
import YamlWorker from 'monaco-yaml/yaml.worker';

import blfschema from '@/assets/blf-schema.json';

configureMonacoYaml(monaco, {
	enableSchemaRequest: false,
	schemas: [{
		fileMatch: ['*.blf.*'],
		// @ts-ignore
		schema: JSON.stringify(blfschema),
		uri: 'https://github.com/remcohaszing/monaco-yaml#usage'
	}]
});


const originalEnv = window.MonacoEnvironment;
window.MonacoEnvironment = {
	...originalEnv,
	getWorkerUrl(moduleId: string, label: string) {
		if (label === 'yaml' || label === 'yml') {
			const blob = new Blob([`importScripts("${new URL('monaco-yaml/yaml.worker', import.meta.url).toString()}");`],{ type: 'application/javascript' });
			return URL.createObjectURL(blob);
		}
		return originalEnv!.getWorkerUrl!(moduleId, label);
	}
}

// @ts-ignore
// const wrapUrl = (url: URL): Promise<URL> => process.env.NODE_ENV === 'development' ? fetch(url.toString())
// 		.then(response => response.blob())
// 		.then(blob => URL.createObjectURL(blob))
// 		.then(url => new URL(url)) : Promise.resolve(url)

// const wrapUrl = url => Promise.resolve(url);
	// @ts-ignore
	// var BlobBuilder = window.MozBlobBuilder || window.WebKitBlobBuilder || window.BlobBuilder,
	// URL = window.URL || window.webkitURL;
	// const mainString = url.toString(),
	// bodyString = mainString.substring(mainString.indexOf("{")+1, mainString.lastIndexOf("}") );
	// const bb = new BlobBuilder();
	// bb.append(bodyString);
	// return URL.createObjectURL(bb.getBlob());
// }
// window.MonacoEnvironment = {
// 	// getWorkerUrl: function(workerId, label) {
// 	// 	switch (label) {
// 	// 		case 'json': return new URL('monaco-editor/esm/vs/language/json/json.worker', import.meta.url).toString();
// 	// 		case 'yaml': return new URL('monaco-yaml/yaml.worker', import.meta.url).toString();
// 	// 		case 'editorWorkerService': return new URL('monaco-editor/esm/vs/editor/editor.worker?worker', import.meta.url).toString();
// 	// 		default: throw new Error(`Unknown label ${label}`);
// 	// 	}
// 	// },
// 	getWorker(moduleId, label) {
// 		debugger;
// 		switch (label) {
// 			case 'editorWorkerService': return wrapUrl(new URL('monaco-editor/esm/vs/editor/editor.worker?worker', import.meta.url)).then(url => new Worker(url, {type: 'module'}))
// 			// case 'css':
// 			// case 'less':
// 			// case 'scss':
// 			//   return new Worker(new URL('monaco-editor/esm/vs/language/css/css.worker', import.meta.url))
// 			// case 'handlebars':
// 			// case 'html':
// 			// case 'razor':
// 			//   return new Worker(
// 			// 	new URL('monaco-editor/esm/vs/language/html/html.worker', import.meta.url)
// 			//   )
// 			case 'json': return wrapUrl(new URL('monaco-editor/esm/vs/language/json/json.worker?worker', import.meta.url)).then(url => new Worker(url, {type: 'module'}))
// 			// case 'javascript':
// 			// case 'typescript':
// 			//   return new Worker(
// 			// 	new URL('monaco-editor/esm/vs/language/typescript/ts.worker', import.meta.url)
// 			//   )
// 			case 'yaml': return new YamlWorker();
// 				//  return wrapUrl(new URL('monaco-yaml/yaml.worker?worker', import.meta.url)).then(url => new Worker(url,{type: 'module'}))
// 			default: throw new Error(`Unknown label ${label}`)
// 		}
// 	}
// }

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
	}),
	mounted() {
		this.editor = monaco.editor.create(this.$refs.editor as HTMLElement, {
			// value: this.value,
			model: monaco.editor.createModel(this.value, this.language, monaco.Uri.file(this.filename)),
			// language: this.language,
			...this.options
		});
		this.editor.onDidChangeModelContent(() => {
			this.emittedValue = this.editor.getValue();
			this.$emit('input', this.emittedValue);
		});
	},
	watch: {
		value(newVal: string) {
			// just going to assume that the browser will optimize this and first check reference equality
			// otherwise we'd be in a bit of pain for very long strings
			if (newVal !== this.emittedValue)
				this.editor.setValue(newVal);
		},
		language(newVal: string) {
			monaco.editor.setModelLanguage(this.editor.getModel()!, newVal);
		},
		// if this changes we need to recreate the model unfortunately
		filename(newVal: string) {
			this.editor.setModel(monaco.editor.createModel(this.value, this.language, monaco.Uri.file(newVal)));
		},
		options: {
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