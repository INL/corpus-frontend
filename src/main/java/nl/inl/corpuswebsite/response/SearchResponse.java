/**
 *
 */
package nl.inl.corpuswebsite.response;

import java.io.IOException;
import java.io.UnsupportedEncodingException;
import java.net.URLEncoder;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.xml.transform.TransformerException;

import org.apache.commons.lang.StringEscapeUtils;

import nl.inl.corpuswebsite.BaseResponse;
import nl.inl.corpuswebsite.MainServlet;
import nl.inl.corpuswebsite.utils.FieldDescriptor;
import nl.inl.corpuswebsite.utils.QueryServiceHandler;
import nl.inl.corpuswebsite.utils.UrlParameterFactory;
import nl.inl.corpuswebsite.utils.XslTransformer;

/**
 *
 */
public class SearchResponse extends BaseResponse {

	final static private String VIEW_PER_HIT = "hits";

	final static private String VIEW_PER_DOC = "docs";

	final static private String VIEW_HITS_GROUPED = "hitsgrouped";

	final static private String VIEW_DOCS_GROUPED = "docsgrouped";

	private QueryServiceHandler webservice = null;
	private XslTransformer transformer = new XslTransformer();
	private StringBuilder builder = new StringBuilder();

	private String resultsStylesheet = null;

	// private String perHitResultStylesheet = null;
	// private String perDocResultStylesheet = null;
	// private String groupHitsResultStylesheet = null;
	// private String groupDocsResultStylesheet = null;

	@Override
	protected void completeRequest() {
		// this.clearContext();

		if (request.getParameterMap().size() > 0) {
			// if any parameters are set, we'll try to interpret the search
			// request
			String view = this.getParameter("view", VIEW_PER_HIT);

			// if the user has only filled in document filters
			// switch to per doc view
			if (isFilterQueryOnly())
				view = VIEW_PER_DOC;

			if (webservice == null) {
				String searchType = view.startsWith("docs") ? "docs" : "hits";
				webservice = new QueryServiceHandler(
						servlet.getWebserviceUrl(corpus) + searchType, servlet);
			}

			if (view.equals(VIEW_PER_HIT))
				doPerHitSearch();
			else if (view.equals(VIEW_PER_DOC))
				doPerDocSearch();
			else if (view.equals(VIEW_HITS_GROUPED))
				doGroupPerHitSearch();
			else if (view.equals(VIEW_DOCS_GROUPED))
				doGroupPerDocSearch();
			getContext().put("view", view);
		}

		// put values back as they were
		getContext().put("querybox", getParameter("querybox", ""));
		getContext().put("tab", getParameter("tab", "#simple"));
		getContext().put("max", getParameter("max", 50));
		getContext().put("responseObject", this);

		//getContext().put("title", servlet.getConfig(corpus).getCorpusName());
		getContext().put("wordproperties",
				servlet.getConfig(corpus).getWordProperties());
		getContext().put("websiteconfig", servlet.getConfig(corpus));
		getContext().put("googleAnalyticsKey", servlet.getGoogleAnalyticsKey(corpus));

		// display template
		displayHtmlTemplate(servlet.getTemplate("search"));
	}

	@Override
	public void init(HttpServletRequest request, HttpServletResponse response,
			MainServlet servlet) {
		super.init(request, response, servlet);
		resultsStylesheet = servlet.getStylesheet(corpus, "results.xsl");
	}

	private boolean isFilterQueryOnly() {
		boolean hasFilter = false;
		for (FieldDescriptor fd : servlet.getConfig(corpus).getFilterFields()) {
			String fieldName = fd.getSearchField();

			if (fd.getType().equalsIgnoreCase("date")) {
				if (this.getParameter(fieldName + "__from", "").length() > 0)
					hasFilter = true;

				if (this.getParameter(fieldName + "__to", "").length() > 0)
					hasFilter = true;

			} else if (this.getParameter(fieldName, "").length() > 0)
				hasFilter = true;
		}

		// if our query is empty and we have at least one filter value
		return (getQuery().length() <= 2) && hasFilter;
	}

	private void doPerHitSearch() {
		String query = getQuery();

		// if we managed to create a query from user input
		if (query.length() > 0) {
			String lang = getLanguage();
			Integer max = this.getParameter("max", 50);
			Integer start = this.getParameter("start", 0);
			String sortBy = this.getParameter("sortBy", "");
			// String sessionId = this.request.getSession().getId();
			String groupBy = this.getParameter("groupBy", "");
			String viewGroup = this.getParameter("viewGroup", "");
			String sort = this.getParameter("sortasc", "1");

			Map<String, String[]> parameters = UrlParameterFactory
					.getSearchParameters(query, lang, max, start, groupBy,
							sortBy, viewGroup, sort);

			addFilterParameters(parameters);

			try {
				parameters.put("block", new String[] { "no" });
				String xmlResult = webservice.makeRequest(parameters);

				setTransformerDisplayParameters(query);

				String htmlResult = transformer.transform(xmlResult,
						resultsStylesheet);
				getContext().put("searchResults", htmlResult);

			} catch (IOException e) {
				throw new RuntimeException(e);
			} catch (TransformerException e) {
				throw new RuntimeException(e);
			}
		}
	}

	private void doPerDocSearch() {
		// TODO: refactor doPerDocSearch and doPerHitSearch to remove duplicate
		// code
		String query = getQuery();

		// if we managed to create a query from user input
		if (query.length() > 2 || isFilterQueryOnly()) {

			if (isFilterQueryOnly()) {
				query = "";
			}

			String lang = getLanguage();
			Integer max = this.getParameter("max", 50);
			Integer start = this.getParameter("start", 0);
			String sortBy = this.getParameter("sortBy", "");
			// String sessionId = this.request.getSession().getId();
			String sort = this.getParameter("sortasc", "1");

			String groupBy = this.getParameter("groupBy", "");
			String viewGroup = this.getParameter("viewGroup", "");

			Map<String, String[]> parameters = UrlParameterFactory
					.getSearchParameters(query, lang, max, start, groupBy,
							sortBy, viewGroup, sort);

			addFilterParameters(parameters);

			try {
				parameters.put("block", new String[] { "no" });
				String xmlResult = webservice.makeRequest(parameters);

				setTransformerDisplayParameters(query);

				String htmlResult = transformer.transform(xmlResult,
						resultsStylesheet);
				getContext().put("searchResults", htmlResult);

			} catch (IOException e) {
				throw new RuntimeException(e);
			} catch (TransformerException e) {
				throw new RuntimeException(e);
			}
		}
	}

	private void doGroupPerHitSearch() {
		// TODO: refactor doPerDocSearch and doPerHitSearch to remove duplicate
		// code
		String query = getQuery();

		// if we managed to create a query from user input
		if (query.length() > 2) {
			String lang = getLanguage();
			Integer max = this.getParameter("max", 50);
			Integer start = this.getParameter("start", 0);
			String sortBy = this.getParameter("sortBy", "");
			// String sessionId = this.request.getSession().getId();
			String sort = this.getParameter("sortasc", "1");

			String groupBy = this.getParameter("groupBy", "");

			if (groupBy.length() > 0) {
				// if we're searching by year, automatically sort
				// chronologically
				if (sortBy.length() == 0) {
					if (groupBy.equalsIgnoreCase(servlet.getSpecialField(corpus, "date")))
						sortBy = "identity";
					else
						sortBy = "size";
				}

				Map<String, String[]> parameters = UrlParameterFactory
						.getSearchParameters(query, lang, max, start, groupBy,
								sortBy, null, sort);

				addFilterParameters(parameters);

				try {
					parameters.put("block", new String[] { "no" });
					String xmlResult = webservice.makeRequest(parameters);

					setTransformerDisplayParameters(query);

					transformer.addParameter("groupBy_name", groupBy);

					String htmlResult = transformer.transform(xmlResult,
							resultsStylesheet);
					getContext().put("searchResults", htmlResult);

				} catch (IOException e) {
					throw new RuntimeException(e);
				} catch (TransformerException e) {
					throw new RuntimeException(e);
				}
			} else {
				// not the most elegant way but it works: display just a
				// grouping selection drop down
				String withoutview = "?" + getUrlParameterStringExcept("view");
				String htmlResult = "<div class=\"span12 contentbox\" id=\"results\">"
						+ "<ul class=\"nav nav-tabs\" id=\"contentTabs\"><li><a href=\""
						+ withoutview
						+ "view="
						+ VIEW_PER_HIT
						+ "\">Per Hit</a></li><li><a href=\""
						+ withoutview
						+ "view="
						+ VIEW_PER_DOC
						+ "\">Per Document</a></li><li class=\"active\"><a href=\""
						+ withoutview
						+ "view="
						+ VIEW_HITS_GROUPED
						+ "\">Hits grouped</a></li><li><a href=\""
						+ withoutview
						+ "view="
						+ VIEW_DOCS_GROUPED
						+ "\">Documents grouped</a></li></ul>"
						+ "<select class=\"input\" name=\"groupBy\" "
						+ "onchange=\"document.searchform.submit();\">"
						+ "<option value=\"\" disabled=\"true\" selected=\"true\">"
						+ "Group hits by...</option>"
						+ "<option value=\"field:"
						+ servlet.getSpecialField(corpus, "title")
						+ "\">Group by document title</option>"
						+ "<option value=\"hit\">Group by hit text</option>"
						+ "<option value=\"hit:lemma\">Group by lemma</option>"
						+ "<option value=\"hit:pos\">Group by hit pos</option>"
						+ "<option value=\"hit:lemma,hit:pos\">Group by lemma and PoS</option>"
						+ "<option value=\"wordleft\">Group by word left</option>"
						+ "<option value=\"wordright\">Group by word right</option>"
						+ "<option value=\"field:"
						+ servlet.getSpecialField(corpus, "date")
						+ "\">Group by year</option>"
						+ "<option value=\"decade:"
						+ servlet.getSpecialField(corpus, "date")
						+ "\" disabled=\"true\">Group by decade</option>"
						+ "</select></div>";
				getContext().put("searchResults", htmlResult);
			}
		}
	}

	private void doGroupPerDocSearch() {
		// TODO: refactor doPerDocSearch and doPerHitSearch to remove duplicate
		// code
		String query = getQuery();

		// if we managed to create a query from user input
		if (query.length() > 2) {
			String lang = getLanguage();
			Integer max = this.getParameter("max", 50);
			Integer start = this.getParameter("start", 0);
			String sortBy = this.getParameter("sortBy", "");
			String groupBy = this.getParameter("groupBy", "");
			// String sessionId = this.request.getSession().getId();
			String sort = this.getParameter("sortasc", "1");

			if (groupBy.length() > 0) {

				// if we're searching by year, automatically sort
				// chronologically
				if (sortBy.length() == 0) {
					if (groupBy.equalsIgnoreCase(servlet.getSpecialField(corpus, "date")))
						sortBy = "identity";
					else
						sortBy = "size";
				}

				Map<String, String[]> parameters = UrlParameterFactory
						.getSearchParameters(query, lang, max, start, groupBy,
								sortBy, null, sort);

				addFilterParameters(parameters);

				try {
					parameters.put("block", new String[] { "no" });
					String xmlResult = webservice.makeRequest(parameters);

					setTransformerDisplayParameters(query);

					transformer.addParameter("groupBy_name", groupBy);

					String htmlResult = transformer.transform(xmlResult,
							resultsStylesheet);
					getContext().put("searchResults", htmlResult);

				} catch (IOException e) {
					throw new RuntimeException(e);
				} catch (TransformerException e) {
					throw new RuntimeException(e);
				}
			} else {
				// not the most elegant way but it works: display just a
				// grouping selection drop down
				String withoutview = "?" + getUrlParameterStringExcept("view");
				String htmlResult = "<div class=\"span12 contentbox\" id=\"results\"><ul class=\"nav nav-tabs\" id=\"contentTabs\"><li><a href=\""
						+ withoutview
						+ "view="
						+ VIEW_PER_HIT
						+ "\">Per Hit</a></li><li><a href=\""
						+ withoutview
						+ "view="
						+ VIEW_PER_DOC
						+ "\">Per Document</a></li><li><a href=\""
						+ withoutview
						+ "view="
						+ VIEW_HITS_GROUPED
						+ "\">Hits grouped</a></li><li class=\"active\"><a href=\""
						+ withoutview
						+ "view="
						+ VIEW_DOCS_GROUPED
						+ "\">Documents grouped</a></li></ul>"
						+ "<select class=\"input\" name=\"groupBy\" onchange=\"document.searchform.submit();\">"
						+ "<option value=\"\" disabled=\"true\" selected=\"true\">Group documents by...</option>"
						+ "<option value=\"numhits\">Group by number of hits</option>"
						+ "<option value=\"field:"
						+ servlet.getSpecialField(corpus, "date")
						+ "\">Group by year</option>"
						+ "<option value=\"decade:"
						+ servlet.getSpecialField(corpus, "date")
						+ "\" disabled=\"true\">Group by decade</option>"
						+ "<option value=\"field:"
						+ servlet.getSpecialField(corpus, "author")
						+ "\">Group by author</option>"
						+ "</select></div>";
				getContext().put("searchResults", htmlResult);
			}
		}
	}

	private void setTransformerDisplayParameters(String query)
			throws UnsupportedEncodingException {
		transformer.clearParameters();
		transformer.addParameter("urlparamwithoutstart", "?"
				+ getUrlParameterStringExcept(new String[] { "start" }, false));
		transformer.addParameter(
				"urlparamwithoutvieworgroup",
				"?"
						+ getUrlParameterStringExcept(new String[] { "view",
								"groupBy" }, false));
		transformer.addParameter("urlparamwithoutsort", "?"
				+ getUrlParameterStringExcept(new String[] { "sortBy" }, true));
		transformer.addParameter(
				"urlparamwithoutvieworgroup",
				"?"
						+ getUrlParameterStringExcept(new String[] { "view",
								"viewGroup", "groupBy" }, false));
		transformer.addParameter("urlparamquery",
				URLEncoder.encode(query, "UTF-8"));
		transformer.addParameter("query", query);
		transformer.addParameter("webserviceurl",
				servlet.getExternalWebserviceUrl(corpus));
		transformer.addParameter("backendRequestUrl",
				webservice.getLastRequestUrlForClient(corpus));
		// transformer.addParameter("resultkey", this.getParameter("key", ""));

		// sometimes a pos field is called "function", sometimes "type",
		// sometimes "pos
		// this code allows us to adjust for that
		for (FieldDescriptor fd : servlet.getConfig(corpus).getWordProperties()) {
			if (fd.getFunction().equalsIgnoreCase("pos"))
				transformer.addParameter("pos_name", fd.getSearchField());
			else if (fd.getFunction().equalsIgnoreCase("lemma"))
				transformer.addParameter("lemma_name", fd.getSearchField());
		}

		// sometimes a title field is called "title", sometimes "title.level1",
		// etc
		// this code allows us to adjust for that
		for (FieldDescriptor fd : servlet.getConfig(corpus).getFilterFields()) {
			if (fd.getFunction().equalsIgnoreCase("title"))
				transformer.addParameter("title_name", fd.getDisplayField());
			else if (fd.getFunction().equalsIgnoreCase("author"))
				transformer.addParameter("author_name", fd.getDisplayField());
			else if (fd.getFunction().equalsIgnoreCase("date"))
				transformer.addParameter("date_name", fd.getDisplayField());
			else if (fd.getFunction().equalsIgnoreCase("source"))
				transformer.addParameter("source_name", fd.getDisplayField());
		}
	}

	private void addFilterParameters(Map<String, String[]> params) {
		StringBuilder filter = new StringBuilder();
		for (FieldDescriptor fd : servlet.getConfig(corpus).getFilterFields()) {
			String[] filterValues = getParameterValues(fd.getSearchField(), "");

			if (fd.getType().equalsIgnoreCase("date")) {
				String from = this.getParameter(fd.getSearchField() + "__from",
						"0");
				String to = this.getParameter(fd.getSearchField() + "__to",
						"3000");
				if (from.equals("0") && to.equals("3000"))
					continue; // no date range submitted, so don't add one
				String dateRange = "[" + from + " TO " + to + "]";
				filterValues = new String[] { dateRange };
			}

			String fieldName = fd.getSearchField();
			if (filterValues.length > 0) {
				StringBuilder value = new StringBuilder();
				int n = 0;
				for (String filterValue : filterValues) {
					filterValue = filterValue.trim();
					if (filterValue.length() > 0) {
						if (value.length() > 0)
							value.append(" OR ");
						value.append(filterValue);
						n++;
					}
				}
				if (n > 0) {
					String strValue = value.toString();
					if (n > 1)
						strValue = "(" + strValue + ")";
					if (filter.length() > 0)
						filter.append(" AND ");
					filter.append(fieldName).append(":").append(strValue);
				}
			}
		}
		params.put("filter", new String[] { filter.toString() });
	}

	private String getQuery() {
		String tab = this.getParameter("tab", "#simple");

		// early out
		if (tab.equalsIgnoreCase("#query"))
			return this.getParameter("querybox", "");

		// otherwise, attempt to make one from the input boxes
		String query = "";

		// make sure that if there are multiple fields containing multiple
		// words,
		// each field contains the same number of words
		if (checkSameNumberOfWordsOrEmpty()) {
			List<FieldDescriptor> fds = servlet.getConfig(corpus)
					.getWordProperties();

			// get a value for a FieldDescriptor that is not ""
			String words = "";
			for (FieldDescriptor fd : fds) {
				if (getValueFor(fd).length() > 0)
					words = getValueFor(fd);
			}

			// count the amount of words the user wants to search for
			int wordCount = words.split("\\s+").length;

			// for each word...
			for (int i = 0; i < wordCount; i++) {
				String queryPart = "[";
				String searchTerm = "";
				boolean isPreceded = false;
				// ...and each FieldDescriptor...
				for (FieldDescriptor fd : fds) {
					searchTerm = getSearchTerm(fd, i, isPreceded);
					if (searchTerm.length() > 0) {
						isPreceded = true;
					}
					// ...get the search term and append it
					queryPart += searchTerm;
				}
				// complete this part and add it to the query
				queryPart += "]";

				// TODO: don't generate parts of the form [property=".*"], use [] instead!
				//  (recent BlackLab versions will recognize this and substitute [], however)

				// make sure not to add empty word queries
				// JN: why not?
				//if (!queryPart.equalsIgnoreCase("[]"))
				query += queryPart + " ";
			}
		} else {
			getContext().put("searcherror",
					"Unequal term count in search fields");
		}

		// System.out.println("query: " + query);
		return query.trim();
	}

	private String getValueFor(FieldDescriptor fd) {
		return escapeBrackets(makeWildcardRegex(this.getParameter(
				fd.getSearchField(), "")));
	}

	public String getParameterValue(String param) {
		String result = this.getParameter(param, "");
		result = StringEscapeUtils.escapeXml(result);
		return result;
	}

	private boolean checkSameNumberOfWordsOrEmpty() {
		int numWords = -1;

		for (FieldDescriptor fd : servlet.getConfig(corpus).getWordProperties()) {
			String argument = this.getParameter(fd.getSearchField(), "").trim();

			if (argument.length() > 0) {
				if (numWords == -1)
					numWords = argument.split("\\s+").length;
				else {
					if (argument.split("\\s+").length != numWords)
						return false;
				}
			}
		}

		return true;
	}

	private String getSearchTerm(FieldDescriptor fd, int index,
			boolean isPreceded) {
		String argument = getValueFor(fd);

		String[] words = argument.split("\\s+");

		// remove wildcard queries for words at the start or end of a query - as
		// long as it is not
		// JN: not necessary anymore, BlackLab deals with this efficiently
//		if (index < words.length && words[index].equalsIgnoreCase(".*")) {
//			if ((index == 0 || index == words.length - 1) && words.length > 1) {
//				return "";
//			}
//
//			if (isPreceded) {
//				return "";
//			}
//		}

		if (index < words.length && argument.length() > 0) {
			if (words[index].equals(".*"))
				return ""; // doesn't add any restrictions

			String sensitive = "";
			String preceded = "";

			if (isPreceded)
				preceded += " & ";

			if (getCaseSensitivity(fd))
				sensitive = "(?-i)"; // force case-sensitive search

			return preceded + fd.getSearchField() + "=\"" + sensitive
					+ words[index] + "\"";
		}

		return "";
	}

	private boolean getCaseSensitivity(FieldDescriptor fd) {
		if (!fd.isSensitive)
			return false;

		return this.getParameter(fd.getSearchField() + "_case", false);
	}

	private static String makeWildcardRegex(String original) {
		return original.replaceAll("\\*", ".*");
	}

	private static String escapeBrackets(String original) {
		return original.replaceAll("\\(", "\\\\(").replaceAll("\\)", "\\\\)");
	}

	private static String getLanguage() {
		return "corpusql";
	}

	private String getUrlParameterStringExcept(String[] excludes,
			boolean flipSort) {
		String sortParameter = "sortasc";
		// clear string builder
		builder.delete(0, builder.length());

		Map<String, String[]> params = request.getParameterMap();
		List<String> excludeList = Arrays.asList(excludes);

		boolean containsSortingParameter = false;
		for (String key : params.keySet()) {
			if (!excludeList.contains(key)) {
				String[] values = params.get(key);
				for (int i = 0; i < values.length; i++) {
					String value = values[i];
					if (value.trim().length() > 0) {
						// flip sorting direction
						if (key.equalsIgnoreCase(sortParameter)) {
							if (flipSort)
								value = flipBooleanValue(value.trim());

							containsSortingParameter = true;
						}

						try {
							String encodedValue = URLEncoder.encode(
									value.trim(), "UTF-8");

							builder.append(key);
							builder.append("=");
							builder.append(encodedValue);
							builder.append("&");
						} catch (UnsupportedEncodingException e) {
							// left blank
						}

					}
				}
			}
		}

		if (!containsSortingParameter) {
			builder.append(sortParameter);
			builder.append("=1&");
		}

		return builder.toString();
	}

	private static String flipBooleanValue(String value) {
		if (value.equalsIgnoreCase("1"))
			return "0";

		return "1";
	}

	private String getUrlParameterStringExcept(String param) {
		return getUrlParameterStringExcept(new String[] { param }, false);
	}

}
