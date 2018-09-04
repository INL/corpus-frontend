// register jquery-ui and the autocomplete widget
import 'jquery-ui';
import 'jquery-ui/ui/widgets/autocomplete';

import * as $ from 'jquery';

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