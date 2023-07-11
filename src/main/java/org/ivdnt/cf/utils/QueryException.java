package org.ivdnt.cf.utils;

public class QueryException extends Exception {
	private final int code;

	public static QueryException wrap(Exception e) {
		if (e instanceof QueryException) return (QueryException) e;
		return new QueryException(e);
	}

	private QueryException(Exception e) {
		super(e);
		this.code = 500;
	}
	
	public QueryException(int code, Exception e) {
		super(e);
		this.code = code;
	}
	
	public QueryException(int code, String message) {
		super(message);
		this.code = code;
	}
	
	public int getHttpStatusCode() {
		return code;
	}
}
