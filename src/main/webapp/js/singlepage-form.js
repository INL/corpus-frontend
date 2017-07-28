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
var SINGLEPAGE = SINGLEPAGE || {}
SINGLEPAGE.FORM = (function () {

	"use strict";

	// Filters with currently valid values, values will need to be processed prior to search
	var activeFilters = [];
	var activeProperties = [];
	
	// Update the filter description using the active filter value list
	var updateFilterDisplay = function() {
		
		var displayHtml = [];
		$.each(activeFilters, function(index, element) {
			displayHtml.push(element.name, ": ", "<i>", element.values.join(", "), " </i>");
		});
		
		$("#filteroverview").html(displayHtml.join(""));
	};
	
	// Add or update the filter in the list when it has a value.
	// Remove the filter from the list when the value is undefined/invalid.
	// Finally update the preview display with the new value
	var updateFilterField = function($filterfield) {
		
		function removeFromFilterList(filterName) {
			activeFilters = $.grep(activeFilters, function(elem) { return elem.name === filterName}, true);
		} 
		
		var filterName = $filterfield.attr('id');
		var filterType = $filterfield.data('filterfield-type');
		var $inputs = $filterfield.find('input, select');
		var values = [];
		
		// Has two input fields, special treatment
		if (filterType === "range") {
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
	
	var updatePropertyField = function($propertyField) {
		function removeFromPropertyList(propertyName) {
			activeProperties = $.grep(activeProperties, function(elem) { return elem.name === propertyName}, true);
		}

		var propertyName = $propertyField.attr('id');
		var prop = {
			name: propertyName,
			value: $propertyField.find('#' + propertyName + "_value").val(),
			case: $propertyField.find('#' + propertyName + "_case").is(':checked')
		};

		removeFromPropertyList(prop.name);
		if (prop.value)
			activeProperties.push(prop);
	}

	return {
		
		init: function() {

			// Inherit jQueryUI autocomplete widget and customize the rendering
			// to apply some bootstrap classes and structure
			$.widget('custom.autocomplete', $.ui.autocomplete, {
				_renderMenu: function(ul, items) {
					var self = this;
					$.each(items, function(index, item){
						self._renderItem(ul, item);
					})
				},
				_renderItem: function(ul, item) {
					$("<li></li>")
						.attr('value', item.value)
						.html("<a>" + item.label + "</a>")
						.data('ui-autocomplete-item', item)
						.appendTo(ul);
				},
				_resizeMenu: function() {
					$(this.menu.element).css({
						"max-height": "300px",
						"overflow-y": "auto",
						"overflow-x": "hidden",
						"width": $(this.element).outerWidth()
					});
				}
			})

			// Now replace all of our autocomplete-marked selects with text inputs with attached autocomplete
			$("select.autocomplete").each(function() {
				var $select = $(this);
				var values = $select.find("option").map(function(index, element) {
					var value = $(element).val();
					return  {
						label: value,
						// Surround the value by quotes, as by default unquoted values are split on whitespace and treated as separate words.
						value: '"' + value + '"', 
					}
				}).get();

				var $autocomplete = $("<input></input>")
					.attr({
						type: 'text',
						class: $select.data('class'),
						placeholder: $select.data('placeholder'),
						style: $select.data('style')
					});

				$select.replaceWith($autocomplete);
				
				$autocomplete.autocomplete({
					source: values,
					minLength: 0, // show values even for empty strings
					classes: {
						"ui-autocomplete": "dropdown-menu"
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

				// show values immediately when first focusing by performing a search directly
				$autocomplete.on('focus', function() {
					$(this).autocomplete('search', $(this).val() || "");
				})
			})
			
			// Register callbacks and sync with current state
			$(".filterfield").on('change', function () {
				updateFilterField($(this));
			}).each(function () {
				updateFilterField($(this));
			});

			$('.propertyfield').on('change', function() {
				updatePropertyField($(this));
			}).each(function() {
				updatePropertyField($(this));
			});
		},
		
		// Clear all fields
		reset: function() {
			$(".filterfield").each(function() {
				SINGLEPAGE.FORM.setFilterValues($(this).attr('id'), []);
			});

			$(".propertyfield").each(function() {
				// Pass object where every value apart from name is undefined to clear all values
				SINGLEPAGE.FORM.setPropertyValues({name: $(this).attr('id')});
			});
		},

		getActiveFilters: function() {
			return activeFilters.length ? activeFilters.concat() : null; // Return a copy
		},
		
		getActiveProperties: function() {
			return activeProperties.length ? activeProperties.concat() : null; // Return a copy 
		},
		
		// Update the values for a filter
		// Automatically updates the preview and internal list as well
		setFilterValues: function(filterName, values) {
			var $filterField = $('#' + filterName);
			var $inputs = $filterField.find('input, select');
			var filterType = $filterField.data('filterfield-type');
			
			// Determine how to process the value of this filter field, based on the type of this filter
			if (filterType == "range") {
				$($inputs[0]).val(values[0]);
				$($inputs[1]).val(values[1]);
			} else if (filterType == "select") {
				$inputs.first().selectpicker('val', values);
			} else {
				$inputs.first().val(values);
			}
			
			updateFilterField($filterField);
		},

		setPropertyValues: function(property) {
			var $propertyField = $('#' + property.name);
			$propertyField.find('#' + property.name + "_value").val(property.value);
			$propertyField.find('#' + property.name + "_case").prop('checked', property.case);
		
			updatePropertyField($propertyField);
		}
	}
})();
