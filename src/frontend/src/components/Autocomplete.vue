<template>
	<input
		:autocomplete="!autocomplete"

		@keypress="_refreshList"
		@keyup.left="_refreshList"
		@keyup.right="_refreshList"
		@click="_refreshList"

		v-model="modelvalue"
	/>
</template>

<script lang="ts">
import Vue from 'vue';
import { NormalizedScopedSlot } from 'vue/types/vnode';

import $ from 'jquery';
import 'jquery-ui';
import 'jquery-ui/ui/widgets/autocomplete';

// Inherit jQueryUI autocomplete widget and customize the rendering
// to apply some bootstrap classes and structure
$.widget('custom.autocomplete', $.ui.autocomplete, {
	_renderMenu(ul: HTMLUListElement, items: any) {
		const self = this;
		$.each(items, function(index, item){
			self._renderItem(ul, item);
		});
	},
	_renderItem(ul: HTMLUListElement, item: {value: string, label: string}) {
		$('<li></li>')
			.attr('value', item.value)
			.html('<a>' + item.label + '</a>')
			.data('ui-autocomplete-item', item)
			.appendTo(ul);
	},
	_resizeMenu() {
		$((this as any).menu.element).css({
			'max-height': '300px',
			'overflow-y': 'auto',
			'overflow-x': 'hidden',
			'width': 'auto',
			'min-width': $(this.element).outerWidth(),
			'max-width': '500px'
		} as JQuery.PlainObject);
	}
});

export default Vue.extend({
	props: {
		value: String,
		url: String,
		autocomplete: {
			default: true,
			type: Boolean
		},
	},
	computed: {
		modelvalue: {
			get(): string { return this.value; },
			set(v: string) { this.$emit('input', v); this.$emit('change', v); }
		}
	},
	methods: {
		_createAutocomplete() {
			const $input = $(this.$el);
			const self = this;
			let lastSearchValue = '';
			let lastSearchResults: string[]|undefined;
			$input.autocomplete({
				// Show values when at least 1 letter is present in the input
				minLength: 1,
				classes: {
					'ui-autocomplete': 'dropdown-menu'
				},
				source(params: any, render: (v: string[]) => void) {
					const {value} = self._getWordAroundCursor(false);
					if (!value.length) {
						return;
					} else if (value === lastSearchValue) {
						if (lastSearchResults) {
							render(lastSearchResults);
						} // user typed quickly or something, results are in flight, will come in eventually...
					} else {
						lastSearchValue = value;
						$.ajax({
							method: 'GET',
							url: self.url,
							data: {term: value},
							dataType: 'json',
							success(data) {
								lastSearchResults = data;
								render(data);
							}
						});
					}
				},
				create() {
					// This element has a div appended every time an element is highlighted
					// but they are never removed... remove this element for now
					$('.ui-helper-hidden-accessible').remove();
				},
				// Manually fire dom change event as autocomplete doesn't fire it when user selects a value
				// and we require change events in other parts of the code.
				select(event, ui) {
					self._autocompleteSelected(ui.item.value);
					return false;
				},
				focus(event, ui) {
					event.preventDefault();
					// prevent jquery from previewing the entire value in the input field.
					// since we run custom value logic
				},
			});
		},
		_destroyAutocomplete() { $(this.$el).autocomplete('destroy'); },
		_refreshList(e: Event) { if (!this.autocomplete) { return; } $(e.target as HTMLElement).autocomplete('search'); },
		/**
		 * @param lookForward select until next whitespace, or only look back
		 */
		_getWordAroundCursor(lookForward: boolean): {start: number, end: number, value: string} {
			const input = this.$el as HTMLInputElement;
			if (input.value.length > 100) {
				return {value : '', start: 0, end: input.value.length};
			}

			let start = input.selectionStart || 0;
			let end = input.selectionEnd || input.value.length;
			if (start > end) { const tmp = start; start = end; end = tmp; }

			if (start === end) { // just a caret; no selection, find whitespace boundaries around cursor
				start = input.value.lastIndexOf(' ', start-1)+1;
				if (lookForward) {
					end = input.value.indexOf(' ', end);
					if (end === -1) { end = input.value.length; }
				}
			}

			const value = input.value.substring(start, end);
			return { start, end, value };
		},
		_autocompleteSelected(v: string) {
			const input = this.$el as HTMLInputElement;
			const value = input.value;

			const {start, end}: {start: number; end: number;} = this._getWordAroundCursor(true);

			input.value = value.substring(0, start) + v + value.substring(end);
			input.selectionStart = start+v.length+1;
			input.selectionEnd = start+v.length+1;

			let event: Event;
			if(typeof(Event) === 'function') {
				event = new Event('input');
			}else{
				event = document.createEvent('Event');
				event.initEvent('input', true, true);
			}
			input.dispatchEvent(event);

		}
	},
	mounted() { if (this.autocomplete) { this._createAutocomplete(); }},
	beforeDestroy() { if (this.autocomplete) { this._destroyAutocomplete(); }},
	watch: {
		autocomplete(v: boolean) {
			v ? this._createAutocomplete() : this._destroyAutocomplete();
		},
	}
});
</script>
