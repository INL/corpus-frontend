/**
 *
 */
package nl.inl.corpuswebsite.utils;

import java.util.LinkedList;
import java.util.List;

/**
 *
 */
public class FieldDescriptor {

	final public String name;
	final public String searchField;
	final public String displayField;
	final public boolean isNumeric;
	final public boolean isFuzzy;
	final public boolean isSensitive;
	final public String function;

	private String tabGroup = "";
	private String type = "";
	private List<ValuePair> validValues = new LinkedList<ValuePair>();

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

	public FieldDescriptor(String argName, boolean argNumeric, boolean argFuzzy, boolean argSensitive, String argSearchField, String argDisplayField, String argFunction) {
		name = argName;
		isNumeric = argNumeric;
		isFuzzy = argFuzzy;
		isSensitive = argSensitive;
		searchField = argSearchField;
		displayField = argDisplayField;

		if(argFunction != null)
			function = argFunction;
		else
			function = argSearchField;
	}

	public String getName() {
		return name;
	}

	public String getSearchField() {
		return searchField;
	}

	public String getDisplayField() {
		return displayField;
	}

	public boolean isNumeric() {
		return isNumeric;
	}

	public boolean isSensitive() {
		return isSensitive;
	}

	public boolean isFuzzy() {
		return isFuzzy;
	}

	public String getFunction() {
		return function;
	}

	public void addValidValue(String value, String description) {
		if(value == null)
			value = "";

		if(value.length() == 0)
			value = description;

		validValues.add(new ValuePair(value, description));
	}

	public boolean restrictedInput() {
		return (validValues.size() > 0);
	}

	public List<ValuePair> getValidValues() {
		return validValues;
	}

	public void setType(String type) {
		if(type == null)
			type = "";

		this.type = type;
	}

	public String getType() {
		return this.type;
	}

	public String getTabGroup() {
		return this.tabGroup;
	}

	public void setTabGroup(String group) {
		if(group == null)
			group = "";

		this.tabGroup = group;
	}
}
