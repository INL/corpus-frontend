export type PropertyField = {
	/** Unique ID of the property */
	name: string;
	/** Raw value of the property */
	value: string;
	/** Should the property match using case sensitivity */
	case: boolean;
};

export type FilterField = {
	/** Unique id of the filter/metadata field */
	name: string;
	/** Type of the filter, determines how the values are interpreted and read from the DOM */
	filterType: 'text'|'range'|'select'
	/** Values of the filter, for selects, the selected values, for text, the text, for ranges the min and max values in indices [0][1] */
	values: string[]
};
