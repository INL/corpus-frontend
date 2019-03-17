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
			$input.autocomplete({
				source: this.autocompleteUrl,
				minLength: 1, // Show values when at least 1 letter is present
				classes: {
					'ui-autocomplete': 'dropdown-menu'
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
		},
		_destroyAutocomplete() {
			const $input = $(this.$refs.autocomplete);
			$input.off('keypress', this._closeAutocomplete);
			$input.autocomplete('destroy');
		},
		_closeAutocomplete($event) {
			const $input = $(this.$refs.autocomplete);
			if ( event.which === 13 ) {
				$input.autocomplete('close');
			}
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
	}
};
