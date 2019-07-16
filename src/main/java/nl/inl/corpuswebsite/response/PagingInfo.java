package nl.inl.corpuswebsite.response;

import nl.inl.corpuswebsite.BaseResponse;

import java.util.HashMap;
import java.util.Map;

/**
 * Encapsulates paging so that a user sees correct values that make sense and blacklab receives -1 for wordstart and wordend
 * to make sure content before and after last word is included. Also holds transformed metadata.
 */
class PagingInfo {

    public static final String WORDEND = "wordend";
    public static final String WORDSTART = "wordstart";

    private final int start, end, max, docLength;
    private Map<String, String[]> params = new HashMap<>(2);
    private final String[] startParam = new String[1];
    private final String[] endParam = new String[1];

    {
        params.put(WORDSTART, startParam);
        params.put(WORDEND, endParam);
    }

    private String metaData;

    PagingInfo(BaseResponse response, int max, int docLength) {
        int start = Math.max(response.getParameter(WORDSTART, 0), 0);
        int end = Math.min(response.getParameter(WORDEND, start + max), start + max);
        if (end==-1) end = docLength;
        this.start = start;
        this.end = end;
        this.max = max;
        this.docLength = docLength;
    }

    String firstUrlQuery() {
        return WORDSTART + "=0&" + WORDEND + "=" + max;
    }

    boolean hasPrev() {
        return start != 0;
    }

    String prevUrlQuery() {
        return start == 0 ? "" : WORDSTART + "=" + (start - max) + "&" + WORDEND + "=" + start;
    }

    boolean hasNext() {
        return end < docLength - 1;
    }

    int wordsShown() {
        return end - start;
    }

    String nextUrlQuery() {
        int forward = end + max >= docLength ? docLength : end + max;
        return end >= docLength ? "" : WORDSTART + "=" + end + "&" + WORDEND + "=" + forward;
    }

    String lastUrlQuery() {
        int lastStart = docLength % max == 0 ? docLength - max : docLength - docLength % max;
        return WORDSTART + "=" + lastStart + "&" + WORDEND + "=" + docLength;
    }

    Map<String, String[]> getBlacklabQuery() {
        startParam[0] = String.valueOf(start == 0 ? -1 : start);
        endParam[0] = String.valueOf(end >= docLength ? -1 : end);
        return params;
    }

    int getStart() {
        return start;
    }

    int getEnd() {
        return end;
    }

    int getMax() {
        return max;
    }

    int getDocLength() {
        return docLength;
    }

    /**
     * Can also be used without paging
     * @return
     */
    String getMetaData() {
        return metaData != null ? metaData : "";
    }

    /**
     * Also called without paging
     * @return
     */
    PagingInfo setMetaData(String metaData) {
        this.metaData = metaData;
        return this;
    }
}
