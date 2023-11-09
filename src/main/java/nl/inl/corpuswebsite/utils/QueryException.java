package nl.inl.corpuswebsite.utils;

public class QueryException extends Exception {
	private final int code;

	public static QueryException wrap(Exception e) {
		if (e instanceof QueryException) return (QueryException) e;
		return new QueryException(e);
	}

	public static QueryException wrap(Exception e, String message) {
		if (e instanceof QueryException) {
			QueryException other = (QueryException) e;
			return new QueryException(other.getCause(), message + ": " + other.getMessage(), other.getHttpStatusCode());
		}
		return new QueryException(e, message, 500);
	}

	private QueryException(Exception e) {
		super(e);
		this.code = 500;
	}

	/** Only for when re-wrapping an exception with a different message. */
	private QueryException(Throwable cause, String message, int code) {
		super(message, cause);
		assert !(cause instanceof QueryException);
		this.code = code;
	}
	
	public QueryException(Exception e, int code) {
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
