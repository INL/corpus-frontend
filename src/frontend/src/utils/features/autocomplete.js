// register jquery-ui and the autocomplete widget
import 'jquery-ui';
import 'jquery-ui/ui/widgets/autocomplete';

import $ from 'jquery';

import {debugLog} from '@/utils/debug';

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

$(document).ready(function() {
	// Now enable autocompletion on our marked fields
	$('input[data-autocomplete]').each(function() {
		var $this = $(this);
		var propertyId = $this.data('autocomplete');

		$this.autocomplete({
			source: BLS_URL + '/autocomplete/' + propertyId,
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
				$(this).val(ui.item.value);
				$(this).trigger('change');
				return false;
			}
		});
		$this.keypress(function( event ) {
			if ( event.which == 13 ) {
				$this.autocomplete('close');
			}
		});
	});
});

debugLog('initializing autocomplete');
