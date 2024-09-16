<template>
	<div style="height: 200px; min-height: 200px;">
		<div ref="editor" :style="{width: '100%', minHeight: options.theme? '100%' : `calc(100% - 1.5em)`}"></div>
		<label v-if="!options?.theme"><input type=checkbox v-model="darkmode"> Dark mode</label>
	</div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';

// This is nasty, but tree-shaking doesn't work well with monaco editor.
// if we do import * as monaco from 'monaco-editor',
// we end up with all features and languages in our bundle, and compilation takes a *long* time.
// Doing it this way saves about 4MB of javascript and speeds up compilation a little.


// FIXME doesn't exist anymore? Seems to work without it.
// import 'monaco-editor/esm/vs/editor/browser/controller/coreCommands.js';

// import 'monaco-editor/esm/vs/editor/browser/widget/codeEditorWidget.js';
// import 'monaco-editor/esm/vs/editor/browser/widget/diffEditorWidget.js';
// import 'monaco-editor/esm/vs/editor/browser/widget/diffNavigator.js';
// import 'monaco-editor/esm/vs/editor/contrib/anchorSelect/browser/anchorSelect.js';
import 'monaco-editor/esm/vs/editor/contrib/bracketMatching/browser/bracketMatching.js';
// import 'monaco-editor/esm/vs/editor/contrib/caretOperations/browser/caretOperations.js';
import 'monaco-editor/esm/vs/editor/contrib/caretOperations/browser/transpose.js';
import 'monaco-editor/esm/vs/editor/contrib/clipboard/browser/clipboard.js';
// import 'monaco-editor/esm/vs/editor/contrib/codeAction/browser/codeActionContributions.js';
// import 'monaco-editor/esm/vs/editor/contrib/codelens/browser/codelensController.js';
// import 'monaco-editor/esm/vs/editor/contrib/colorPicker/browser/colorContributions.js';
import 'monaco-editor/esm/vs/editor/contrib/comment/browser/comment.js';
// import 'monaco-editor/esm/vs/editor/contrib/contextmenu/browser/contextmenu.js';
// import 'monaco-editor/esm/vs/editor/contrib/cursorUndo/browser/cursorUndo.js';
// import 'monaco-editor/esm/vs/editor/contrib/dnd/browser/dnd.js';
// import 'monaco-editor/esm/vs/editor/contrib/documentSymbols/browser/documentSymbols.js';
import 'monaco-editor/esm/vs/editor/contrib/find/browser/findController.js';
import 'monaco-editor/esm/vs/editor/contrib/folding/browser/folding.js';
import 'monaco-editor/esm/vs/editor/contrib/fontZoom/browser/fontZoom.js';
// import 'monaco-editor/esm/vs/editor/contrib/format/browser/formatActions.js';
// import 'monaco-editor/esm/vs/editor/contrib/gotoError/browser/gotoError.js';
// import 'monaco-editor/esm/vs/editor/contrib/gotoSymbol/browser/goToCommands.js';
// import 'monaco-editor/esm/vs/editor/contrib/gotoSymbol/link/browser/goToDefinitionAtPosition.js';
import 'monaco-editor/esm/vs/editor/contrib/hover/browser/hover.js';
import 'monaco-editor/esm/vs/editor/contrib/inPlaceReplace/browser/inPlaceReplace.js';
// import 'monaco-editor/esm/vs/editor/contrib/indentation/browser/indentation.js';
// import 'monaco-editor/esm/vs/editor/contrib/inlineHints/browser/inlineHintsController.js';
// import 'monaco-editor/esm/vs/editor/contrib/linesOperations/browser/linesOperations.js';
// import 'monaco-editor/esm/vs/editor/contrib/linkedEditing/browser/linkedEditing.js';
// import 'monaco-editor/esm/vs/editor/contrib/links/browser/links.js';
import 'monaco-editor/esm/vs/editor/contrib/multicursor/browser/multicursor.js';
// import 'monaco-editor/esm/vs/editor/contrib/parameterHints/browser/parameterHints.js';
import 'monaco-editor/esm/vs/editor/contrib/rename/browser/rename.js';
// import 'monaco-editor/esm/vs/editor/contrib/smartSelect/browser/smartSelect.js';
// import 'monaco-editor/esm/vs/editor/contrib/snippet/browser/snippetController2.js';
import 'monaco-editor/esm/vs/editor/contrib/suggest/browser/suggestController.js';
// import 'monaco-editor/esm/vs/editor/contrib/toggleTabFocusMode/browser/toggleTabFocusMode.js';
// import 'monaco-editor/esm/vs/editor/contrib/unusualLineTerminators/browser/unusualLineTerminators.js';
// import 'monaco-editor/esm/vs/editor/contrib/viewportSemanticTokens/browser/viewportSemanticTokens.js';
// import 'monaco-editor/esm/vs/editor/contrib/wordHighlighter/browser/wordHighlighter.js';
// import 'monaco-editor/esm/vs/editor/contrib/wordOperations/browser/wordOperations.js';
// import 'monaco-editor/esm/vs/editor/contrib/wordPartOperations/browser/wordPartOperations.js';
// import 'monaco-editor/esm/vs/editor/standalone/browser/accessibilityHelp/accessibilityHelp.js';
// import 'monaco-editor/esm/vs/editor/standalone/browser/iPadShowKeyboard/iPadShowKeyboard.js';
// import 'monaco-editor/esm/vs/editor/standalone/browser/inspectTokens/inspectTokens.js';
// import 'monaco-editor/esm/vs/editor/standalone/browser/quickAccess/standaloneCommandsQuickAccess.js';
// import 'monaco-editor/esm/vs/editor/standalone/browser/quickAccess/standaloneGotoLineQuickAccess.js';
// import 'monaco-editor/esm/vs/editor/standalone/browser/quickAccess/standaloneGotoSymbolQuickAccess.js';
// import 'monaco-editor/esm/vs/editor/standalone/browser/quickAccess/standaloneHelpQuickAccess.js';
// import 'monaco-editor/esm/vs/editor/standalone/browser/referenceSearch/standaloneReferenceSearch.js';
// import 'monaco-editor/esm/vs/editor/standalone/browser/toggleHighContrast/toggleHighContrast.js';
// END_FEATURES
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';

// (2) Desired languages:
// BEGIN_LANGUAGES
// import 'monaco-editor/esm/vs/language/css/monaco.contribution.js';
// import 'monaco-editor/esm/vs/language/html/monaco.contribution.js';
import 'monaco-editor/esm/vs/language/json/monaco.contribution.js';
// import 'monaco-editor/esm/vs/language/typescript/monaco.contribution.js';
// import 'monaco-editor/esm/vs/basic-languages/abap/abap.contribution.js';
// import 'monaco-editor/esm/vs/basic-languages/apex/apex.contribution.js';
// import 'monaco-editor/esm/vs/basic-languages/azcli/azcli.contribution.js';
// import 'monaco-editor/esm/vs/basic-languages/bat/bat.contribution.js';
// import 'monaco-editor/esm/vs/basic-languages/cameligo/cameligo.contribution.js';
// import 'monaco-editor/esm/vs/basic-languages/clojure/clojure.contribution.js';
// import 'monaco-editor/esm/vs/basic-languages/coffee/coffee.contribution.js';
// import 'monaco-editor/esm/vs/basic-languages/cpp/cpp.contribution.js';
// import 'monaco-editor/esm/vs/basic-languages/csharp/csharp.contribution.js';
// import 'monaco-editor/esm/vs/basic-languages/csp/csp.contribution.js';
// import 'monaco-editor/esm/vs/basic-languages/css/css.contribution.js';
// import 'monaco-editor/esm/vs/basic-languages/dart/dart.contribution.js';
// import 'monaco-editor/esm/vs/basic-languages/dockerfile/dockerfile.contribution.js';
// import 'monaco-editor/esm/vs/basic-languages/ecl/ecl.contribution.js';
// import 'monaco-editor/esm/vs/basic-languages/fsharp/fsharp.contribution.js';
// import 'monaco-editor/esm/vs/basic-languages/go/go.contribution.js';
// import 'monaco-editor/esm/vs/basic-languages/graphql/graphql.contribution.js';
// import 'monaco-editor/esm/vs/basic-languages/handlebars/handlebars.contribution.js';
// import 'monaco-editor/esm/vs/basic-languages/hcl/hcl.contribution.js';
// import 'monaco-editor/esm/vs/basic-languages/html/html.contribution.js';
// import 'monaco-editor/esm/vs/basic-languages/ini/ini.contribution.js';
// import 'monaco-editor/esm/vs/basic-languages/java/java.contribution.js';
// import 'monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution.js';
// import 'monaco-editor/esm/vs/basic-languages/julia/julia.contribution.js';
// import 'monaco-editor/esm/vs/basic-languages/kotlin/kotlin.contribution.js';
// import 'monaco-editor/esm/vs/basic-languages/less/less.contribution.js';
// import 'monaco-editor/esm/vs/basic-languages/lexon/lexon.contribution.js';
// import 'monaco-editor/esm/vs/basic-languages/lua/lua.contribution.js';
// import 'monaco-editor/esm/vs/basic-languages/m3/m3.contribution.js';
// import 'monaco-editor/esm/vs/basic-languages/markdown/markdown.contribution.js';
// import 'monaco-editor/esm/vs/basic-languages/mips/mips.contribution.js';
// import 'monaco-editor/esm/vs/basic-languages/msdax/msdax.contribution.js';
// import 'monaco-editor/esm/vs/basic-languages/mysql/mysql.contribution.js';
// import 'monaco-editor/esm/vs/basic-languages/objective-c/objective-c.contribution.js';
// import 'monaco-editor/esm/vs/basic-languages/pascal/pascal.contribution.js';
// import 'monaco-editor/esm/vs/basic-languages/pascaligo/pascaligo.contribution.js';
// import 'monaco-editor/esm/vs/basic-languages/perl/perl.contribution.js';
// import 'monaco-editor/esm/vs/basic-languages/pgsql/pgsql.contribution.js';
// import 'monaco-editor/esm/vs/basic-languages/php/php.contribution.js';
// import 'monaco-editor/esm/vs/basic-languages/postiats/postiats.contribution.js';
// import 'monaco-editor/esm/vs/basic-languages/powerquery/powerquery.contribution.js';
// import 'monaco-editor/esm/vs/basic-languages/powershell/powershell.contribution.js';
// import 'monaco-editor/esm/vs/basic-languages/pug/pug.contribution.js';
// import 'monaco-editor/esm/vs/basic-languages/python/python.contribution.js';
// import 'monaco-editor/esm/vs/basic-languages/r/r.contribution.js';
// import 'monaco-editor/esm/vs/basic-languages/razor/razor.contribution.js';
// import 'monaco-editor/esm/vs/basic-languages/redis/redis.contribution.js';
// import 'monaco-editor/esm/vs/basic-languages/redshift/redshift.contribution.js';
// import 'monaco-editor/esm/vs/basic-languages/restructuredtext/restructuredtext.contribution.js';
// import 'monaco-editor/esm/vs/basic-languages/ruby/ruby.contribution.js';
// import 'monaco-editor/esm/vs/basic-languages/rust/rust.contribution.js';
// import 'monaco-editor/esm/vs/basic-languages/sb/sb.contribution.js';
// import 'monaco-editor/esm/vs/basic-languages/scala/scala.contribution.js';
// import 'monaco-editor/esm/vs/basic-languages/scheme/scheme.contribution.js';
// import 'monaco-editor/esm/vs/basic-languages/scss/scss.contribution.js';
// import 'monaco-editor/esm/vs/basic-languages/shell/shell.contribution.js';
// import 'monaco-editor/esm/vs/basic-languages/solidity/solidity.contribution.js';
// import 'monaco-editor/esm/vs/basic-languages/sophia/sophia.contribution.js';
// import 'monaco-editor/esm/vs/basic-languages/sql/sql.contribution.js';
// import 'monaco-editor/esm/vs/basic-languages/st/st.contribution.js';
// import 'monaco-editor/esm/vs/basic-languages/swift/swift.contribution.js';
// import 'monaco-editor/esm/vs/basic-languages/systemverilog/systemverilog.contribution.js';
// import 'monaco-editor/esm/vs/basic-languages/tcl/tcl.contribution.js';
// import 'monaco-editor/esm/vs/basic-languages/twig/twig.contribution.js';
// import 'monaco-editor/esm/vs/basic-languages/typescript/typescript.contribution.js';
// import 'monaco-editor/esm/vs/basic-languages/vb/vb.contribution.js';
// import 'monaco-editor/esm/vs/basic-languages/xml/xml.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/yaml/yaml.contribution.js';

import { configureMonacoYaml } from 'monaco-yaml';
import type {JSONSchema7} from 'json-schema';
import blfschema from '@/assets/blf-schema.json';

configureMonacoYaml(monaco, {
	enableSchemaRequest: false,
	schemas: [{
		fileMatch: ['*.blf.yaml'],

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
		fileMatch: ['*.blf.json'],
		schema: blfschema
	}],
	allowComments: true,
});

window.MonacoEnvironment = {
	getWorker(moduleId, label) {
		switch (label) {
		case 'editorWorkerService':
			return new Worker(new URL('monaco-editor/esm/vs/editor/editor.worker', import.meta.url))
//		case 'css':
//		case 'less':
//		case 'scss':
//			return new Worker(new URL('monaco-editor/esm/vs/language/css/css.worker', import.meta.url))
//		case 'handlebars':
//		case 'html':
//		case 'razor':
//			return new Worker(new URL('monaco-editor/esm/vs/language/html/html.worker', import.meta.url))
//		case 'javascript':
//		case 'typescript':
//			return new Worker(new URL('monaco-editor/esm/vs/language/typescript/ts.worker', import.meta.url))
		case 'json':
			return new Worker(new URL('monaco-editor/esm/vs/language/json/json.worker', import.meta.url))
		case 'yaml':
			return new Worker(new URL('monaco-yaml/yaml.worker', import.meta.url))
		default:
			throw new Error(`Unknown label ${label}`)
		}
	}
}

export default defineComponent({
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
			if (newModel) {
				newModel.setValue(contents);
				monaco.editor.setModelLanguage(newModel, language);
			}
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
			const value = this.editor.getValue();
			if (value !== this.value) {
				this.emittedValue = value;
				this.$emit('input', this.emittedValue);
			}
		});
	},

	watch: {
		// Assume a reference comparison is made first
		// https://stackoverflow.com/questions/23836825/is-javascript-string-comparison-just-as-fast-as-number-comparison
		// So long models *should* be okay, as long as vue doesn't copy the emitted input event string internally.
		value(newVal: string) {  if (newVal !== this.emittedValue) this.editor.setValue(newVal || ''); },
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