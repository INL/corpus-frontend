/* global BLS_URL */

import * as $ from 'jquery';

import {FilterField, PropertyField} from '../types/pagetypes';

declare var BLS_URL: string;

// Filters with currently valid values, values will need to be processed prior to search
let activeFilters: FilterField[] = [];
let activeProperties: PropertyField[] = [];
let within: string|null = null;

// Update the filter description using the active filter value list
function updateFilterDisplay() {

	const displayHtml = [];
	$.each(activeFilters, function(index, element) {
		displayHtml.push(element.name, ': ', '<i>', element.values.join(', '), ' </i>');
	});

	$('#filteroverview').html(displayHtml.join(''));
}

// Add or update the filter in the list when it has a value.
// Remove the filter from the list when the value is undefined/invalid.
// Finally update the preview display with the new value
function updateFilterField($filterfield) {

	function removeFromFilterList(filterName) {
		activeFilters = $.grep(activeFilters, function(elem) { return elem.name === filterName;}, true);
	}

	const filterName = $filterfield.attr('id');
	const filterType = $filterfield.data('filterfield-type');
	const $inputs = $filterfield.find('input, select');
	let values = [];

	// Has two input fields, special treatment
	if (filterType === 'range') {
		const from = $($inputs[0]).val();
		const to = $($inputs[1]).val();

		if (from && to) { // Since these are text inputs, any falsy value ('', undefined, null) is invalid
			values.push(from, to);
		}
	} else {
		// We always store values in an array because multiselect and date fields both have multiple values
		// Concatenate values since firstVal might be an array itself
		// val might be an array (in case of multiselect), so concatenate to deal with single values as well as arrays
		const firstVal = $inputs.first().val();
		if (firstVal != null && firstVal != '') {
			values = values.concat(firstVal);
		}
	}

	removeFromFilterList(filterName);
	if (values.length >= 1) {
		activeFilters.push({
			name: filterName,
			filterType,
			values
		});
	}

	updateFilterDisplay();
}

// TODO tidy up
function updatePropertyField($propertyField, event?) {
	function removeFromPropertyList(id: string) {
		activeProperties = $.grep(activeProperties, function(elem) { return elem.name === id;}, true);
	}

	const propertyName = $propertyField.attr('id');
	const $textOrSelect = $propertyField.find('#' + propertyName + '_value');
	const fileInput = $propertyField.find('#' + propertyName + '_file')[0]; // NOTE: not always available
	const $caseInput = $propertyField.find('#' + propertyName + '_case');
	const $changedInput = event ? $(event.target) : $textOrSelect; // no event means we're initializing, so read from the input field

	// Fetch the current state, or init the new property (if it wasn't in the list)
	const prop = activeProperties.find(p => p.name === propertyName) || {} as PropertyField;// $.grep(activeProperties, function(elem) { return elem.name === propertyName; })[0] || {};
	prop.name = propertyName;
	prop.case = $caseInput.is(':checked');
	prop.value = $textOrSelect.val();

	// Now temporarily remove the property from the active list (even if it actually has a value)
	// and only put it back once we've read its new value
	// This has the added benefit we can never push the prop twice by accident
	removeFromPropertyList(prop.name);

	if ($changedInput.is($textOrSelect[0]) && fileInput != null) {
		fileInput.value = '';
	}

	if ($changedInput.is(fileInput)) {
		const file = fileInput.files && fileInput.files[0];
		if (file != null) {
			const fr = new FileReader();
			fr.onload = function() {
				// Replace all whitespace with pipes,
				// this is due to the rather specific way whitespace in the simple search property fields is treated (see singlepage-bls.js:getPatternString)
				// TODO discuss how we treat these fields with Jan/Katrien, see https://github.com/INL/corpus-frontend/issues/18
				prop.value = (fr.result as string).replace(/\s+/g, '|');
				$textOrSelect.val(prop.value);

				if (prop.value) {
					activeProperties.push(prop);
				}
			};
			fr.readAsText(file);
		} else {
			prop.value = '';
			$textOrSelect.val('');
			// Don't push back into active props, we've just cleared the value
		}
	} else {
		if (prop.value) {
			activeProperties.push(prop);
		}
	}
}

function updateWithin($radioButtonContainer) {
	// explicitly set to null for empty strings
	within = $radioButtonContainer.find('input:checked').val() || null;
}

$(document).ready(function() {

	// Now enable autocompletion on our marked fields
	$('input[data-autocomplete]').each(function() {
		const $this = $(this);
		const propertyId = $this.data('autocomplete');

		$this.autocomplete({
			source: BLS_URL + '/autocomplete/' + propertyId,
			minLength: 1, // Show values when at least 1 letter is present
			classes: {
				'ui-autocomplete': 'dropdown-menu'
			},
			create () {
				// This element has a div appended every time an element is highlighted
				// but they are never removed... remove this element for now
				$('.ui-helper-hidden-accessible').remove();
			},
			// Manually fire dom change event as autocomplete doesn't fire it when user selects a value
			// and we require change events in other parts of the code.
			select (event, ui) {
				$(this).val(ui.item.value);
				$(this).trigger('change');
				return false;
			}
		});
		$this.keypress(function( event ) {
			if ( event.which === 13 ) {
				$this.autocomplete('close');
			}
		});
	});

	// Register callbacks and sync with current state
	$('.filterfield').on('change', function() {
		updateFilterField($(this));
	}).each(function() {
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
});

/** Clears all metadata, simple search properties, and within selector */
export function reset() {
	$('.filterfield').each(function() {
		setFilterValues($(this).attr('id'), []);
	});

	$('.propertyfield').each(function() {
		// Pass object where every value apart from name is undefined to clear all values
		setPropertyValues({name: $(this).attr('id')});
	});

	$('#simplesearch_within input').first().parent().button('toggle');
	$('#simplesearch_within').trigger('change');
}

/** Get all metadata fields holding a value, or null */
export function	getActiveFilters() {
	return activeFilters.length ? activeFilters.concat() : null; // Return a copy
}

/** Get all simple search properties holding a value, or null */
export function	getActiveProperties() {
	return activeProperties.length ? activeProperties.concat() : null; // Return a copy
}

/** Get current within clause */
export function getWithin() {
	return within;
}

/**
 * Update the values for a filter
 * Automatically updates the preview and internal list as well
 * Passing null/undefined/[] as values will clear the values
 * @param {string} filterName
 * @param {Array.<string>} values - for 'range' type filters, index 0 and 1 are 'from' and 'to' respectively, for 'select' values, all values are selected, for all others: values are concatenated
 */
export function setFilterValues(filterName, values) {
	const $filterField = $('#' + filterName);
	if (!$filterField.length) { // Might happen when loading external queries?
		return;
	}
	const $inputs = $filterField.find('input, select');
	const filterType = $filterField.data('filterfield-type');

	// Determine how to process the value of this filter field, based on the type of this filter
	if (filterType === 'range') {
		$($inputs[0]).val(values[0]);
		$($inputs[1]).val(values[1]);
	} else if (filterType === 'select') {
		$inputs.first().selectpicker('val', values);
	} else {
		const processed  = [];
		$.each(values, function(index, val) {
			const withoutQuotes = val.replace(/^"+|"+$/g, '');
			if (withoutQuotes.match(/\s/)) { // contains whitespace -> keep quotes
				processed.push('"' + withoutQuotes + '"');
			}
			else {
				processed.push(withoutQuotes);
			}
		});

		$inputs.first().val(processed.join(' '));
	}

	updateFilterField($filterField);
}

/**
 * Sets the property to the specified value and case sensitivity.
 * Updates both the UI and the getActiveProperties list.
 * Missing property.value or property.case will clear those values.
 *
 * @param {PropertyField} property
 */
export function setPropertyValues(property) {
	const $propertyField = $('#' + property.name);
	if (!$propertyField.length) { // Might happen when loading external queries
		return;
	}

	if (typeof property.value === 'undefined') {
		property.value = null;
	} // bootstrap-select doesn't do anything when setting to undefined, so instead set null
	property.case = property.case || false;

	const $input = $propertyField.find('#' + property.name + '_value');
	$input.is('select') ? $input.selectpicker('val', property.value) : $input.val(property.value);
	$propertyField.find('#' + property.name + '_case').prop('checked', property.case);

	updatePropertyField($propertyField);
}

// value should be the raw name, not enclosed in </>
export function setWithin(value) {
	value = value || '';
	// Bootstrap needs us to call toggle on the containing label...
	$('#simplesearch_within input[value="'+value+'"]').parent().button('toggle');
}
