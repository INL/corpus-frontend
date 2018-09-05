export type PropertyField = {
	/** Unique ID of the property */
	name: string;
	/** Raw value of the property */
	value: string;
	/** Should the property match using case sensitivity */
	case: boolean;
};

export const enum FilterType {
	'range',
	'select',
	'combobox',
	'text'
}

export type FilterField = {
	/** Unique id of the filter/metadata field */
	name: string;
	/**
	 * Type of the filter, determines how the values are interpreted and read from the DOM
	 * See CorpusConfig.java/search.vm
	 *
	 * 'range' -> has two numerical inputs, min and max
	 * 'select' -> is a multiselect field
	 *
	 * There is also 'combobox' and 'text',
	 * but these are just a regular text input (with some autocompletion on combobox)
	 * and can be treated the same way for the purposes of state and DOM manipulation
	 *
	 * It's possible for a user to specify another type (using uiType for annotatedFields and metadataFields in the index format),
	 * but this should just be ignored and treated as 'text'.
	 */
	filterType: FilterType|string;
	/** Values of the filter, for selects, the selected values, for text, the text, for ranges the min and max values in indices [0][1] */
	values: string[];
};
