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

	public static Map<String, String[]> getSearchParameters(String query, Integer view, String lang, Integer max, Integer start, String groupBy, String sortBy, String key, String viewGroup, String sort) {
		if(searchBaseMap == null)
			UrlParameterFactory.initSearchBaseMap();

		// create map based on default map
		Map<String, String[]> myMap = new HashMap<String, String[]>(searchBaseMap);

		// change non default values
		if(query != null)
			myMap.put("query", new String[]{query});

		if(view != null)
			myMap.put("view", new String[]{view.toString()});

		if(lang != null)
			myMap.put("qlang", new String[]{lang});

		if(max != null)
			myMap.put("max", new String[]{max.toString()});

		if(start != null)
			myMap.put("start", new String[]{start.toString()});

		if(groupBy != null)
			myMap.put("groupBy", new String[]{groupBy});

		if(sortBy != null)
			myMap.put("sortBy", new String[]{sortBy});

		if(key != null)
			myMap.put("key", new String[]{key});

		if(viewGroup != null)
			myMap.put("viewGroup", new String[]{viewGroup});

		if(sort != null)
			myMap.put("sortasc", new String[]{sort});

		return myMap;
	}

	public static Map<String, String[]> getSourceParameters(String query, Integer doc, String lang) {
		if(sourceBaseMap == null)
			UrlParameterFactory.initSourceBaseMap();

		// create map based on default map
		Map<String, String[]> myMap = new HashMap<String, String[]>(sourceBaseMap);

		if(query != null)
			myMap.put("query", new String[]{query});

		if(lang != null)
			myMap.put("qlang", new String[]{lang});

		if(doc != null)
			myMap.put("docid", new String[]{doc.toString()});

		return myMap;
	}

	private static void initSearchBaseMap() {
		// make map with default parameter values
		searchBaseMap = new HashMap<String, String[]>();

		searchBaseMap.put("query", new String[]{""});
		searchBaseMap.put("view", new String[]{"1"});
		searchBaseMap.put("qlang", new String[]{"corpusQL"});
		searchBaseMap.put("max", new String[]{"50"});
		searchBaseMap.put("start", new String[]{"0"});
	}

	private static void initSourceBaseMap() {
		// make map with default parameter values
		sourceBaseMap = new HashMap<String, String[]>();

		sourceBaseMap.put("query", new String[]{""});
		sourceBaseMap.put("docid", new String[]{"-1"});
		sourceBaseMap.put("qlang", new String[]{"corpusQL"});
	}
}
