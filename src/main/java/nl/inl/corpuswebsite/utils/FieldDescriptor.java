/**
 *
 */
package nl.inl.corpuswebsite.utils;

import java.util.LinkedList;
import java.util.List;

/**
 * Descriptor for all searchable parameters
 * Shared between metadata and word properties
 */
public class FieldDescriptor {
	private String id;
	private String displayName;
	private String type;

	/** Never true for metadata fields */
	private boolean isCaseSensitive = false;

	/** Which complex field did this field/property originate from - Never set for metadata fields */
	private String complexFieldName = null;

	private List<ValuePair> validValues = new LinkedList<>();

	public class ValuePair {
		public final String value;
		public final String description;

		public ValuePair(String value, String description) {
			this.value = value;
			this.description = description;
		}

		public String getValue() {
			return value;
		}

		public String getDescription() {
			return description;
		}
	}

	public FieldDescriptor(String id, String displayName, String type) {
		if (id == null || id.isEmpty())
			throw new RuntimeException("Empty id for FieldDescriptor");

		if (displayName == null || displayName.isEmpty())
			displayName = id;

		this.id = id;
		this.displayName = displayName;
		this.type = type;
	}

	public String getId() {
		return id;
	}

	public String getDisplayName() {
		return displayName;
	}

	public void setDisplayName(String displayName) {
		this.displayName = displayName;
	}

	public String getType() {
		return type;
	}

	public boolean isCaseSensitive() {
		return isCaseSensitive;
	}

	public void setCaseSensitive(boolean caseSensitive) {
		this.isCaseSensitive = caseSensitive;
	}

	public void setComplexFieldName(String complexFieldName) {
		this.complexFieldName = complexFieldName;
	}

	public String getComplexFieldName() {
		return complexFieldName;
	}

	public void addValidValue(String value, String description) {
		if (value == null || value.isEmpty())
			return;

		if (description == null || description.isEmpty())
			description = value;

		validValues.add(new ValuePair(value, description));
	}

	public List<ValuePair> getValidValues() {
		return validValues;
	}

	public boolean isRestrictedInput() {
		return (validValues.size() > 0);
	}
}
