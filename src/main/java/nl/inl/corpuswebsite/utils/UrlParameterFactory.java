/**
 *
 */
package nl.inl.corpuswebsite.utils;

import java.util.HashMap;
import java.util.Map;

/**
 *
 */
public class UrlParameterFactory {

	private static Map<String, String[]> searchBaseMap = null;
	private static Map<String, String[]> sourceBaseMap = null;

	public static Map<String, String[]> getSearchParameters(String cqlQuery, /*
																				* Integer
																				* view
																				* ,
																				*/
			String lang, Integer numberOfResults, Integer firstResult,
			String groupBy, String sortBy, /* String key, */String viewGroup,
			String sortAscending) {
		if (searchBaseMap == null)
			UrlParameterFactory.initSearchBaseMap();

		// create map based on default map
		Map<String, String[]> myMap = new HashMap<>(
				searchBaseMap);

		// change non default values
		if (cqlQuery != null && cqlQuery.length() != 0)
			myMap.put("patt", new String[] { cqlQuery });

		if (lang != null && !lang.equals("corpusql"))
			myMap.put("pattlang", new String[] { lang });

		if (firstResult != null && firstResult != 0)
			myMap.put("first", new String[] { firstResult.toString() });

		if (numberOfResults != null)
			myMap.put("number", new String[] { numberOfResults.toString() });

		if (groupBy != null)
			myMap.put("group", new String[] { groupBy });

		if (sortBy != null) {
			if (sortAscending.equals("1")) {
				// Ascending
				myMap.put("sort", new String[] { sortBy });
			} else {
				// Descending
				myMap.put("sort", new String[] { "-" + sortBy });
			}
		}

		if (viewGroup != null)
			myMap.put("viewgroup", new String[] { viewGroup });

		return myMap;
	}

	public static Map<String, String[]> getSourceParameters(String query,
			String lang) {
		if (sourceBaseMap == null)
			UrlParameterFactory.initSourceBaseMap();

		// create map based on default map
		Map<String, String[]> myMap = new HashMap<>(
				sourceBaseMap);

		if (query != null)
			myMap.put("patt", new String[] { query });

		if (lang != null && !lang.equals("corpusql"))
			myMap.put("pattlang", new String[] { lang });

		return myMap;
	}

	private static void initSearchBaseMap() {
		// make map with default parameter values
		searchBaseMap = new HashMap<>();
		searchBaseMap.put("number", new String[] { "50" });
	}

	private static void initSourceBaseMap() {
		// make map with default parameter values
		sourceBaseMap = new HashMap<>();
	}
}
