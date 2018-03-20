/* global BLS_URL */

/**
 * @typedef {Object} PropertyField
 * @property {string} name - Unique ID of the property
 * @property {string} value - Raw value of the property
 * @property {boolean} case - Should the property match using case sensitivity
 */

/**
 * @typedef {Object} FilterField
 * @property {string} name - Unique ID of the filter
 * @property {string} filterType - Type of the filter, one of 'range', 'text', 'select', 'combobox'
 * @property {Array.<string>} values - Values of the filter, for selects, the selected values, for text, the text, for ranges the min and max values in indices [0][1]
 */

// Our global symbol
var SINGLEPAGE = SINGLEPAGE || {};
SINGLEPAGE.FORM = (function () {

	'use strict';

	// Filters with currently valid values, values will need to be processed prior to search
	var activeFilters = [];
	var activeProperties = [];
	var within = null;
	
	// Update the filter description using the active filter value list
	var updateFilterDisplay = function() {
		
		var displayHtml = [];
		$.each(activeFilters, function(index, element) {
			displayHtml.push(element.name, ': ', '<i>', element.values.join(', '), ' </i>');
		});
		
		$('#filteroverview').html(displayHtml.join(''));
	};
	
	// Add or update the filter in the list when it has a value.
	// Remove the filter from the list when the value is undefined/invalid.
	// Finally update the preview display with the new value
	var updateFilterField = function($filterfield) {
		
		function removeFromFilterList(filterName) {
			activeFilters = $.grep(activeFilters, function(elem) { return elem.name === filterName;}, true);
		} 
		
		var filterName = $filterfield.attr('id');
		var filterType = $filterfield.data('filterfield-type');
		var $inputs = $filterfield.find('input, select');
		var values = [];
		
		// Has two input fields, special treatment
		if (filterType === 'range') {
			var from = $($inputs[0]).val();
			var to = $($inputs[1]).val();
			
			if (from && to) // Since these are text inputs, any falsy value ('', undefined, null) is invalid
				values.push(from, to);
		} else {
			// We always store values in an array because multiselect and date fields both have multiple values
			// Concatenate values since firstVal might be an array itself
			// val might be an array (in case of multiselect), so concatenate to deal with single values as well as arrays
			var firstVal = $inputs.first().val();
			if (firstVal != null && firstVal != '')
				values = values.concat(firstVal);
		}
		
		removeFromFilterList(filterName);
		if (values.length >= 1) {
			activeFilters.push({
				name: filterName,
				filterType: filterType,
				values: values					
			});
		}
		
		updateFilterDisplay();
	};
	
	// TODO tidy up
	var updatePropertyField = function($propertyField, event) {
		function removeFromPropertyList(propertyName) {
			activeProperties = $.grep(activeProperties, function(elem) { return elem.name === propertyName;}, true);
		}
		
		var propertyName = $propertyField.attr('id');
		var $textOrSelect = $propertyField.find('#' + propertyName + '_value');
		var fileInput = $propertyField.find('#' + propertyName + '_file')[0]; // NOTE: not always available
		var $caseInput = $propertyField.find('#' + propertyName + '_case');
		var $changedInput = event ? $(event.target) : $textOrSelect; // no event means we're initializing, so read from the input field
		
		// Fetch the current state, or init the new property (if it wasn't in the list)
		var prop = $.grep(activeProperties, function(elem) { return elem.name === propertyName; })[0] || {};
		prop.name = propertyName;
		prop.case = $caseInput.is(':checked');
		prop.value = prop.value || ''; // init in case of new prop
		
		// Now temporarily remove the property from the active list (even if it actually has a value)
		// and only put it back once we've read its new value
		removeFromPropertyList(prop.name);
		
		// Then set the new value, and once it's resolved, put it back in the list if the value is valid
		if ($changedInput.is($textOrSelect[0])) {
			prop.value = $textOrSelect.val();
			if (fileInput != null) 
				fileInput.value = '';
			if (prop.value)
				activeProperties.push(prop);
		} else if ($changedInput.is(fileInput)) {
			var file = fileInput.files && fileInput.files[0];
			if (file != null) {
				var fr = new FileReader();
				fr.onload = function() {
					// Replace all whitespace with pipes, 
					// this is due to the rather specific way whitespace in the simple search property fields is treated (see singlepage-bls.js:getPatternString)
					// TODO discuss how we treat these fields with Jan/Katrien, see https://github.com/INL/corpus-frontend/issues/18
					prop.value = fr.result.replace(/\s+/g, '|');
					$textOrSelect.val(prop.value);
					
					if (prop.value)
						activeProperties.push(prop);
				};
				fr.readAsText(file);
			} else {
				prop.value = '';
				$textOrSelect.val('');
				// Don't push back into active props, we've just cleared the value
			}
		} 
	};

	var updateWithin = function($radioButtonContainer) {
		// explicitly set to null for empty strings
		within = $radioButtonContainer.find('input:checked').val() || null;
	};

	return {
		
		init: function() {

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

			// Now replace all of our autocomplete-marked selects with text inputs with attached autocomplete
			$('select.autocomplete').each(function() {
				var $select = $(this);

				var $autocomplete = $('<input></input>').attr({
					type: 'text',
					class: $select.data('class'),
					placeholder: $select.data('placeholder'),
					style: $select.data('style')
				});

				// zoek eerste ancestor div met id
				var propId = $select.closest('.propertyfield, .filterfield').attr('id');
				$select.replaceWith($autocomplete);

				$autocomplete.autocomplete({
					source: BLS_URL + '/autocomplete/' + propId,
					minLength: 0, // show values even for empty strings
					classes: {
						'ui-autocomplete': 'dropdown-menu'
					},
					create: function() {
						// This element has a div appended every time an element is highlighted
						// but they are never removed... remove this element for now
						$('.ui-helper-hidden-accessible').remove();
					},
					// Manually fire dom change event as autocomplete doesn't fire it when user selects a value
					// we lisen to this event 
					select: function(event, ui) {
						$(this).val(ui.item.value);
						$(this).trigger('change');
						return false;
					}
				});
				$autocomplete.keypress(function( event ) {
					if ( event.which == 13 ) {
						$autocomplete.autocomplete('close');
					}
				});
			});
			
			// Register callbacks and sync with current state
			$('.filterfield').on('change', function () {
				updateFilterField($(this));
			}).each(function () {
				updateFilterField($(this));
			});

			$('.propertyfield').on('change', function(event) {
				updatePropertyField($(this), event);
			}).each(function() {
				updatePropertyField($(this), null);
			});

			$('#simplesearch_within').on('change', function() {
				updateWithin($(this));
			}).each(function() {
				updateWithin($(this));
			});
		},
		
		// Clear all fields
		reset: function() {
			$('.filterfield').each(function() {
				SINGLEPAGE.FORM.setFilterValues($(this).attr('id'), []);
			});

			$('.propertyfield').each(function() {
				// Pass object where every value apart from name is undefined to clear all values
				SINGLEPAGE.FORM.setPropertyValues({name: $(this).attr('id')});
			});

			$('#simplesearch_within input').first().parent().button('toggle');
			$('#simplesearch_within').trigger('change');

		},

		getActiveFilters: function() {
			return activeFilters.length ? activeFilters.concat() : null; // Return a copy
		},
		
		getActiveProperties: function() {
			return activeProperties.length ? activeProperties.concat() : null; // Return a copy 
		},

		getWithin: function() {
			return within;
		},
		
		// Update the values for a filter
		// Automatically updates the preview and internal list as well
		setFilterValues: function(filterName, values) {
			var $filterField = $('#' + filterName);
			var $inputs = $filterField.find('input, select');
			var filterType = $filterField.data('filterfield-type');
			
			// Determine how to process the value of this filter field, based on the type of this filter
			if (filterType == 'range') {
				$($inputs[0]).val(values[0]);
				$($inputs[1]).val(values[1]);
			} else if (filterType == 'select') {
				$inputs.first().selectpicker('val', values);
			} else {
				$inputs.first().val(values);
			}
			
			updateFilterField($filterField);
		},

		setPropertyValues: function(property) {
			var $propertyField = $('#' + property.name);
			$propertyField.find('#' + property.name + '_value').val(property.value);
			$propertyField.find('#' + property.name + '_case').prop('checked', property.case);
		
			updatePropertyField($propertyField);
		},

		// value should be the raw name, not enclosed in </>
		setWithin: function(value) {
			value = value || '';
			// Bootstrap needs us to call toggle on the containing label...
			$('#simplesearch_within input[value="'+value+'"]').parent().button('toggle');
		}
	};
})();
