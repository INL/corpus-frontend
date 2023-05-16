package nl.inl.corpuswebsite.utils;

import java.util.Optional;
import java.util.function.Function;

public class Result<R, E extends Exception> {
    public interface ThrowableSupplier<R, E extends Exception> {
        R apply() throws E;
    }

    public interface ThrowableFunction<A, R, E extends Exception> {
        R apply(A a) throws E;
    }

    private final R result;
    private final E error;

    public Result(R result, E error) {
        this.result = result;
        this.error = error;
    }

    public static <R> Result<R, Exception> attempt(ThrowableSupplier<R, Exception> gen) {
        try {
            return new Result<>(gen.apply(), null);
        } catch (Exception e) {
            if (e instanceof ReturnToClientException) throw (ReturnToClientException) e;
            return Result.error(e);
        }
    }

    /** Map the result, if any, to a new result, without any error handling. */
    @SuppressWarnings("unchecked")
    public <R2> Result<R2, E> map(Function<R, R2> mapper) {
        if (this.result != null) return new Result<>(mapper.apply(this.result), null);
        return (Result<R2, E>) this;
    }

    /** Map the result, if any, to a new result, without any error handling. */
    @SuppressWarnings("unchecked")
    public <R2> Result<R2, E> flatMap(Function<R, Result<R2, E>> mapper) {
        if (this.result != null) return mapper.apply(this.result);
        return (Result<R2, E>) this;
    }

    /** Map the result, if any, to a new result, capturing any Exception thrown in the process */
    @SuppressWarnings("unchecked")
    public <R2> Result<R2, Exception> mapAnyError(ThrowableFunction<R, R2, Exception> mapper) {
        if (this.result != null) {
            try { return new Result<>(mapper.apply(this.result), null); }
            catch (Exception e) {
                if (e instanceof ReturnToClientException) throw (ReturnToClientException) e;
                else return new Result<>(null, e);
            }
        }
        return (Result<R2, Exception>) this;
    }

    /** Map the result, if any, to a new result, capturing any Exception thrown in the process */
    @SuppressWarnings("unchecked")
    public <R2> Result<R2, Exception> flatMapAnyError(Function<R, Result<R2, Exception>> mapper) {
        if (this.result != null) {
            try { return mapper.apply(this.result); }
            catch (Exception e) {
                if (e instanceof ReturnToClientException) throw (ReturnToClientException) e;
                else return new Result<>(null, e);
            }
        }
        return (Result<R2, Exception>) this;
    }

    /** Map the error, if any, to a new result, without any error handling. */
    @SuppressWarnings("unchecked")
    public <R2> Result<R2, E> recover(Function<E, R2> mapper) {
        if (this.error != null) {
            return new Result<>(mapper.apply(this.error), null);
        } else {
            return (Result<R2, E>) this;
        }
    }

    public <R2, E2 extends Exception> Result<R2, E> recover(Class<E2> clazz, Function<E2, Result<R2, Exception>> mapper) {
        if (this.error != null) {
            return mapper.apply(this.error);
        } else {
            return (Result<R2, E>) this;
        }
    }

    /** Map the error, if any, to a new result, without any error handling. */
    public <R2> Result<R2, E> flatRecover(Function<E, Result<R2, E>> mapper) {
        if (this.error != null) {
            return mapper.apply(this.error);
        } else {
            return (Result<R2, E>) this;
        }
    }




    public static <R, E extends Exception> Result<R, E> success(R result) {
        return new Result<>(result, null);
    }

    public static <R, E extends Exception> Result<R, E> error(E error) {
        return new Result<>(null, error);
    }

    public Optional<E> getError() {
        return Optional.ofNullable(error);
    }

    public Optional<R> getResult() {
        return Optional.ofNullable(result);
    }

    public R getOrThrow() throws E {
        if (this.error != null) throw this.error;
        if (this.result == null) throw new IllegalStateException("Result is null");
        return this.result;
    }
}
