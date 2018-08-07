package nl.inl.corpuswebsite.utils;

import java.util.LinkedList;
import java.util.List;
import java.util.Objects;

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

    /** Which annotated field did this field/property originate from - Never set for metadata fields */
    private String annotatedFieldName = null;

    /**
     * is this a "main" property - e.g. for cql query "word" is this property the one that's used. Always false for
     * metadata/"document" fields
     */
    private boolean isMainProperty = false;

    private List<ValuePair> validValues = new LinkedList<>();

    public static class ValuePair {
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
            throw new IllegalArgumentException("Empty id for FieldDescriptor");

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

    public void setAnnotatedFieldName(String annotatedFieldName) {
        this.annotatedFieldName = annotatedFieldName;
    }

    public String getAnnotatedFieldName() {
        return annotatedFieldName;
    }

    public void setMainProperty(boolean mainProperty) {
        this.isMainProperty = mainProperty;
    }

    public boolean isMainProperty() {
        return isMainProperty;
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

    @Override
    public int hashCode() {
        int hash = 7;
        hash = 79 * hash + Objects.hashCode(this.id);
        return hash;
    }

    @Override
    public boolean equals(Object obj) {
        if (this == obj) {
            return true;
        }
        if (obj == null) {
            return false;
        }
        if (getClass() != obj.getClass()) {
            return false;
        }
        final FieldDescriptor other = (FieldDescriptor) obj;
        return Objects.equals(this.id, other.id);
    }
}
