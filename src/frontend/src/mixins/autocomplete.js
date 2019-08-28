import $ from 'jquery';
import 'jquery-ui';
import 'jquery-ui/ui/widgets/autocomplete';

// Inherit jQueryUI autocomplete widget and customize the rendering
// to apply some bootstrap classes and structure
$.widget('custom.autocomplete', $.ui.autocomplete, {
	_renderMenu: function(ul, items) {
		var self = this;
		$.each(items, function(index, item){
			self._renderItem(ul, item);
		});
	},
	_renderItem: function(ul, item) {
		$('<li></li>')
			.attr('value', item.value)
			.html('<a>' + item.label + '</a>')
			.data('ui-autocomplete-item', item)
			.appendTo(ul);
	},
	_resizeMenu: function() {
		$(this.menu.element).css({
			'max-height': '300px',
			'overflow-y': 'auto',
			'overflow-x': 'hidden',
			'width': $(this.element).outerWidth()
		});
	}
});

export default {
	computed: {
		autocompleteUrl() { throw new Error('please implement'); },
		autocomplete() { throw new Error('please implement'); }
	},
	methods: {
		autocompleteSelected(value) { throw new Error('please implement'); },
		_initAutocomplete() {
			if (this.$refs.autocomplete == null) {
				throw new Error('autocomplete mixin requires autocomplete ref');
			}
			const $input = $(this.$refs.autocomplete);
			const self = this;
			/** @type {string} */
			let lastSearchValue;
			/** @type {string[]|undefined} */
			let lastSearchResults;
			$input.autocomplete({
				minLength: 1, // Show values when at least 1 letter is present in the input
				classes: {
					'ui-autocomplete': 'dropdown-menu'
				},
				source: function(params, render) {
					const {value} = self._getWordAroundCursor();
					if (value.length <= 1) {
						return;
					} else if (value === lastSearchValue) {
						if (lastSearchResults) {
							render(lastSearchResults);
						} // user typed quickly or something, results are in flight, will come in eventually...
					} else {
						lastSearchValue = value;
						$.ajax({
							method: 'GET',
							url: self.autocompleteUrl,
							data: {term: value},
							dataType: 'json',
							success: function(data) {
								lastSearchResults = data;
								render(data);
							}
						})
					}
				},
				create: function() {
					// This element has a div appended every time an element is highlighted
					// but they are never removed... remove this element for now
					$('.ui-helper-hidden-accessible').remove();
				},
				// Manually fire dom change event as autocomplete doesn't fire it when user selects a value
				// and we require change events in other parts of the code.
				select: function(event, ui) {
					self.autocompleteSelected(ui.item.value);
					return false;
				},
				focus: function(event, ui) {
					event.preventDefault();
					// prevent jquery from previewing the entire value in the input field.
					// since we run custom value logic
				},
				_renderMenu: function(ul, items) {
					const ui = this;
					$.each(items, function(index, item){
						ui._renderItem(ul, item);
					});
				},
				_renderItem: function(ul, item) {
					$('<li></li>')
						.attr('value', item.value)
						.html('<a>' + item.label + '</a>')
						.data('ui-autocomplete-item', item)
						.appendTo(ul);
				},
				_resizeMenu: function() {
					$(this.menu.element).css({
						'max-height': '300px',
						'overflow-y': 'auto',
						'overflow-x': 'hidden',
						'width': $(this.element).outerWidth()
					});
				}
			});

			$input.on('keypress', this._closeAutocomplete);
			$input.on('click', () => $input.autocomplete('search'));
			$input.on('keypress', function(event) {
				switch (event.which) {
					case 37:
					case 39:
					$input.autocomplete('search')
				}
			})
		},
		_destroyAutocomplete() {
			const $input = $(this.$refs.autocomplete);
			$input.off('keypress', this._closeAutocomplete);
			$input.autocomplete('destroy');
		},
		_closeAutocomplete(event) {
			const $input = $(this.$refs.autocomplete);
			if ( event.which === 13 ) {
				$input.autocomplete('close');
			}
		},
		/**
		 *
		 * @param {HTMLInputElement} input
		 * @returns
		 */
		_getWordAroundCursor() {
			/** @type {HTMLInputElement} */
			const input = this.$refs.autocomplete;
			if (input.value.length > 100) {
				return '';
			}

			let start = input.selectionStart || 0;
			let end = input.selectionEnd || input.value.length;
			if (start > end) {
				const tmp = start;
				start = end;
				end = tmp;
			}

			if (start === end) { // just a caret; no selection, find whitespace boundaries around cursor
				start = input.value.lastIndexOf(' ', start) + 1;
				end = input.value.indexOf(' ', end);

				if (end === -1) { end = input.value.length; }
			}

			const value = input.value.substring(start, end);

			return {
				start,
				end,
				value
			};
		}
	},
	watch: {
		autocomplete(autocomplete) {
			if (autocomplete) {
				this.$nextTick(this._initAutocomplete); // wait for rerender so $ref is set
			} else {
				this._destroyAutocomplete();
			}
		}
	},
	mounted() {
		if (this.autocomplete) {
			this._initAutocomplete();
		}
	},
	destroyed() {
		if (this.autocomplete) {
			this._destroyAutocomplete();
		}
	},
};