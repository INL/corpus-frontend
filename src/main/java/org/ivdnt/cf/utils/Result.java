package org.ivdnt.cf.utils;

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
        return attempt(Exception.class, gen);
    }
    public static <R, ErrorClass extends Exception> Result<R, Exception> attempt(Class<ErrorClass> c, ThrowableSupplier<R, Exception> gen) {
        try {
            return new Result<>(gen.apply(), null);
        } catch (Exception e) {
            if (e instanceof ReturnToClientException) throw (ReturnToClientException) e;
            if (c.isAssignableFrom(e.getClass())) return Result.error(e);
            else throw new RuntimeException(e);
        }
    }

    /** Map the result, if any, to a new result, without any error handling. */
    @SuppressWarnings("unchecked")
    public <R2> Result<R2, E> map(Function<R, R2> mapper) {
        if (this.result != null) return new Result<>(mapper.apply(this.result), null);
        return (Result<R2, E>) this;
    }

//    /** Map the result, if any, to a new result, without any error handling. */
//    @SuppressWarnings("unchecked")
//    public <R2> Result<R2, E> flatMap(Function<R, Result<R2, E>> mapper) {
//        if (this.result != null) return mapper.apply(this.result);
//        return (Result<R2, E>) this;
//    }

    @SuppressWarnings("unchecked")
    public <R2, E2 extends Exception> Result<R2, E2> flatMap(Function<R, Result<R2, E2>> mapper) {
        if (this.result != null) return mapper.apply(this.result);
        return (Result<R2, E2>) this;
    }

    /** Map the result, if any, to a new result, capturing any Exception thrown in the process */
    @SuppressWarnings("unchecked")
    public <R2> Result<R2, Exception> mapWithErrorHandling(ThrowableFunction<R, R2, Exception> mapper) {
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
    public <R2> Result<R2, Exception> flatMapWithErrorHandling(ThrowableFunction<R, Result<R2, Exception>, Exception> mapper) {
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
    public Result<R, E> recover(Function<E, R> mapper) {
        if (this.error != null) return Result.success(mapper.apply(this.error));
        return this;
    }

    /** Map the error, if any, to a new result, without any error handling. */
    public <ErrorClass extends E> Result<R, E> recover(Class<ErrorClass> c, Function<ErrorClass, R> mapper) {
        if (this.error != null && c.isAssignableFrom(this.error.getClass())) return Result.success(mapper.apply(c.cast(this.error)));
        return this;
    }

    /** Map the error, if any, to a new result, without any error handling. */
    public Result<R, E> flatRecover(Function<E, Result<R, E>> mapper) {
        if (this.error != null) return mapper.apply(this.error);
        return this;
    }

    /** Map the error, if any, to a new result, without any error handling. */
    public <ErrorClass extends E> Result<R, E> flatRecover(Class<ErrorClass> c, Function<ErrorClass, Result<R, E>> mapper) {
        if (this.error != null && c.isAssignableFrom(this.error.getClass())) return mapper.apply(c.cast(this.error));
        return this;
    }

    @SuppressWarnings("unchecked")
    public Result<R, Exception> recoverWithErrorHandling(ThrowableFunction<E, R, Exception> mapper) {
        if (this.error != null) {
            try { return Result.success(mapper.apply(this.error)); }
            catch (Exception e) {
                if (e instanceof ReturnToClientException) throw (ReturnToClientException) e;
                else return new Result<>(null, e);
            }
        }
        return (Result<R, Exception>) this;
    }

    @SuppressWarnings("unchecked")
    public <ErrorClass extends E> Result<R, Exception> recoverWithErrorHandling(Class<ErrorClass> c, ThrowableFunction<ErrorClass, R, Exception> mapper) {
        if (this.error != null && c.isAssignableFrom(this.error.getClass())) {
            try { return Result.success(mapper.apply(c.cast(this.error))); }
            catch (Exception e) {
                if (e instanceof ReturnToClientException) throw (ReturnToClientException) e;
                else return new Result<>(null, e);
            }
        }
        return (Result<R, Exception>) this;
    }

    @SuppressWarnings("unchecked")
    public Result<R, Exception> flatRecoverWithErrorHandling(ThrowableFunction<E, Result<R, Exception>, Exception> mapper) {
        if (this.error != null) {
            try { return mapper.apply(this.error); }
            catch (Exception e) {
                if (e instanceof ReturnToClientException) throw (ReturnToClientException) e;
                else return new Result<>(null, e);
            }
        }
        return (Result<R, Exception>) this;
    }

    @SuppressWarnings("unchecked")
    public <ErrorClass extends E> Result<R, Exception> flatRecoverWithErrorHandling(Class<ErrorClass> c, ThrowableFunction<ErrorClass, Result<R, Exception>, Exception> mapper) {
        if (this.error != null && c.isAssignableFrom(this.error.getClass())) {
            try { return mapper.apply(c.cast(this.error)); }
            catch (Exception e) {
                if (e instanceof ReturnToClientException) throw (ReturnToClientException) e;
                else return new Result<>(null, e);
            }
        }
        return (Result<R, Exception>) this;
    }

    @SuppressWarnings("unchecked")
    public <E2 extends Exception> Result<R, E2> mapError(Function<E, E2> mapper) {
        if (this.error != null) return Result.error(mapper.apply(this.error));
        return (Result<R, E2>) this;
    }

    @SuppressWarnings("unchecked")
    public <ErrorClass extends E, E2 extends Exception> Result<R, E2> mapError(Class<ErrorClass> c, Function<ErrorClass, E2> mapper) {
        if (this.error != null && c.isAssignableFrom(this.error.getClass())) return Result.error(mapper.apply(c.cast(this.error)));
        return (Result<R, E2>) this;
    }

    @SuppressWarnings("unchecked")
    public <E2 extends Exception> Result<R, E2> flatMapError(Function<E, Result<R, E2>> mapper) {
        if (this.error != null) return mapper.apply(this.error);
        return (Result<R, E2>) this;
    }

    @SuppressWarnings("unchecked")
    public <ErrorClass extends E, E2 extends Exception> Result<R, E2> flatMapError(Class<ErrorClass> c, Function<ErrorClass, Result<R, E2>> mapper) {
        if (this.error != null && c.isAssignableFrom(this.error.getClass())) return mapper.apply(c.cast(this.error));
        return (Result<R, E2>) this;
    }

    @SuppressWarnings("unchecked")
    public Result<R, Exception> mapErrorWithErrorHandling(ThrowableFunction<E, Exception, Exception> mapper) {
        if (this.error != null) {
            try { return Result.error(mapper.apply(this.error)); }
            catch (Exception e) {
                if (e instanceof ReturnToClientException) throw (ReturnToClientException) e;
                else return new Result<>(null, e);
            }
        }
        return (Result<R, Exception>) this;
    }

    @SuppressWarnings("unchecked")
    public <ErrorClass extends E> Result<R, Exception> mapErrorWithErrorHandling(Class<ErrorClass> c, ThrowableFunction<ErrorClass, Exception, Exception> mapper) {
        if (this.error != null && c.isAssignableFrom(this.error.getClass()))  {
            try { return Result.error(mapper.apply(c.cast(this.error))); }
            catch (Exception e) {
                if (e instanceof ReturnToClientException) throw (ReturnToClientException) e;
                else return new Result<>(null, e);
            }
        }
        return (Result<R, Exception>) this;
    }

    public static <R, E extends Exception> Result<R, E> success(R result) {
        return new Result<>(result, null);
    }

    public static <R, E extends Exception> Result<R, E> error(E error) {
        return new Result<>(null, error);
    }

    public static <R> Result<R, Exception> error(String message) {
        return new Result<>(null, new Exception(message));
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

    public R getOrThrow(Function<E, RuntimeException> mapper) {
        if (this.error != null) throw mapper.apply(this.error);
        if (this.result == null) throw new IllegalStateException("Result is null");
        return this.result;
    }

    public void throwIfError() throws E {
        if (this.error != null) throw this.error;
    }

    public void throwIfError(Function<E, RuntimeException> mapper) {
        if (this.error != null) throw mapper.apply(this.error);
    }
}
