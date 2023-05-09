package nl.inl.corpuswebsite.utils;

public class QueryException extends Exception {
	private int code;
	
	public QueryException(Exception e) {
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
