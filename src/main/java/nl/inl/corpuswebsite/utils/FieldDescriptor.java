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
	private String tabGroup = "";

	/* Never true for metadata fields */
	private boolean isCaseSensitive = false;

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

	public String getType() {
		return type;
	}

	// TODO set on construction and remove setter
	public void setType(String type) {
		this.type = type;
	}

	public String getTabGroup() {
		return tabGroup;
	}

	public void setTabGroup(String tabGroup) {
		if (tabGroup != null)
			this.tabGroup = tabGroup;
		else
			this.tabGroup = "";
	}

	public boolean isCaseSensitive() {
		return isCaseSensitive;
	}

	public void setCaseSensitive(boolean caseSensitive) {
		this.isCaseSensitive = caseSensitive;
	}

	// TODO: change when FieldDescriptors generated from blacklab-server info
	public void addValidValue(String value, String description) {
		if (value == null)
			value = "";

		if (value.length() == 0)
			value = description;

		validValues.add(new ValuePair(value, description));
	}

	public List<ValuePair> getValidValues() {
		return validValues;
	}

	public boolean isRestrictedInput() {
		return (validValues.size() > 0);
	}
}
