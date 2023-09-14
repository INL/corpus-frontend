package org.ivdnt.cf.utils;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;

/**
 * A class that represents the result of a computation that may throw an exception.
 * @param <R> the type of the result that may be held.
 * @param <E> the type of exception that may be held.
 */
public class Result<R, E extends Exception> {
    /**
     * A function that may throw a specific type of checked exception.
     * @param <R> the return type of the function.
     * @param <E> the type of exception that may be thrown.
     */
    public interface ThrowableSupplier<R, E extends Exception> {
        R apply() throws E;
    }

    /**
     * A function that may throw a specific type of checked exception.
     * @param <A> the argument of the function.
     * @param <R> the return type of the function.
     * @param <E> the type of exception that may be thrown.
     */
    public interface ThrowableFunction<A, R, E extends Exception> {
        R apply(A a) throws E;
    }

    private final static Set<Class<? extends Exception>> neverCatch = Set.of(
            ReturnToClientException.class
    );

    private final R result;
    private final E error;


    public Result(R result, E error) {
        this.result = result;
        this.error = error;
    }

    public static <R, E extends Exception> Result<R, E> empty() {
        return new Result<>(null, null);
    }
    public static <R, E extends Exception> Result<R, E> from(Optional<R> optional) {
        return Result.success(optional.orElse(null));
    }

    public boolean isEmpty() { return this.result == null && this.error == null;    }
    public boolean hasResult() { return this.result != null; }
    public boolean hasError() { return this.error != null; }

    /** If holding a result, call the consumer with it */
    public Result<R, E> tap(Consumer<R> consumer) {
        if (this.result != null) consumer.accept(this.result);
        return this;
    }
    /** If holding an error, call the consumer with it */
    public Result<R, E> tapError(Consumer<E> consumer) {
        if (this.error != null) consumer.accept(this.error);
        return this;
    }

    /**
     * Begin a chain of operations on the result of gen.
     * Exceptions within the generator will be caught.
     */
    public static <R> Result<R, Exception> attempt(ThrowableSupplier<R, Exception> gen) {
        return attempt(Exception.class, gen);
    }

    /**
     * Begin a chain of operations on the result of gen.
     * Exceptions within the generator will be caught.
     */
    public static <R, ErrorClass extends Exception> Result<R, Exception> attempt(Class<ErrorClass> c, ThrowableSupplier<R, Exception> gen) {
        try {
            return new Result<>(gen.apply(), null);
        } catch (Exception e) {
            if (e instanceof ReturnToClientException) throw (ReturnToClientException) e;
            if (c.isAssignableFrom(e.getClass())) return Result.error(e);
            else throw new RuntimeException(e);
            // the method threw a different exception than our type.
            // Since subsequent calls to recover/mapError would try to cast it to our type,
            // that would throw a ClassCastException.
            // so just abort now.
        }
    }

    /**
     * Map the currently held result, if present, to a new result.
     * Exceptions within the mapper will not be caught.
     */
    @SuppressWarnings("unchecked")
    public <R2> Result<R2, E> map(Function<R, R2> mapper) {
        if (this.result != null) return new Result<>(mapper.apply(this.result), null);
        return (Result<R2, E>) this;
    }

    /**
     * Map the currently held result, if present, to a new result.
     * Exceptions within the mapper will not be caught.
     */
    @SuppressWarnings("unchecked")
    public <R2, E2 extends Exception> Result<R2, E2> flatMap(Function<R, Result<R2, E2>> mapper) {
        if (this.result != null) return mapper.apply(this.result);
        return (Result<R2, E2>) this;
    }

    /**
     * Map the currently held result, if present, to a new result.
     * Exceptions within the mapper will be caught.
     */
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

    /**
     * Map the currently held result, if present, to a new result.
     * Exceptions within the mapper will be caught.
     */
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

    /**
     * Use other if this Result is currently empty.
     * @return 'this' if either error or result is present, other otherwise.
     */
    public Result<R, E> or(Result<R, E> other) {
        if (this.result != null || this.error != null) return this;
        return other;
    }

    /**
     * Use other if this Result is currently empty.
     * @return 'this' if either error or result is present, result of other otherwise.
     */
    public Result<R, E> or(Supplier<Result<R, E>> other) {
        if (this.result != null || this.error != null) return this;
        return other.get();
    }

    /**
     * Use other if this Result is currently empty.
     * @return 'this' if either error or result is present, other otherwise.
     */
    public Result<R, E> or(R other) {
        if (this.result != null || this.error != null) return this;
        return Result.success(other);
    }


    /**
     * Use other if this Result is currently empty.
     * @return this if either error or result is present, other otherwise.
     */
    public Result<R, E> orError(Supplier<E> other) {
        if (this.result != null || this.error != null) return this;
        return Result.error(other.get());
    }


    /**
     * Use other if this Result is currently empty.
     * @return 'this' if either error or result is present, other otherwise.
     */
    public Result<R, E> orError(E other) {
        if (this.result != null || this.error != null) return this;
        return Result.error(other);
    }

    /**
     * Map the currently held exception, if present, to a new result.
     * Exceptions within the mapper will not be caught.
     */
    public Result<R, E> recover(Function<E, R> mapper) {
        if (this.error != null) return Result.success(mapper.apply(this.error));
        return this;
    }

    /**
     * Map the currently held exception, if present and matching the class, to a new result.
     * Exceptions within the mapper will not be caught.
     * When an Exception of a different class is currently held, the mapper will not be called,
     * and the current result will be returned.
     */
    public <ErrorClass extends E> Result<R, E> recover(Class<ErrorClass> c, Function<ErrorClass, R> mapper) {
        if (this.error != null && c.isAssignableFrom(this.error.getClass())) return Result.success(mapper.apply(c.cast(this.error)));
        return this;
    }

    /**
     * Map the currently held exception, if present, to a new result.
     * Exceptions within the mapper will not be caught.
     */
    public Result<R, E> flatRecover(Function<E, Result<R, E>> mapper) {
        if (this.error != null) return mapper.apply(this.error);
        return this;
    }

    /**
     * Map the currently held exception, if present and matching the class, to a new result.
     * Exceptions within the mapper will not be caught.
     * When an Exception of a different class is currently held, the mapper will not be called,
     * and the current result will be returned.
     */    public <ErrorClass extends E> Result<R, E> flatRecover(Class<ErrorClass> c, Function<ErrorClass, Result<R, E>> mapper) {
        if (this.error != null && c.isAssignableFrom(this.error.getClass())) return mapper.apply(c.cast(this.error));
        return this;
    }

    /**
     * Map the currently held exception, if present, to a new result.
     * Exceptions within the mapper will be caught.
     */
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

    /**
     * Map the currently held exception, if present and matching the class, to a new result.
     * Exceptions within the mapper will be caught.
     */
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


    /**
     * Map the currently held exception, if present, to a new result.
     * Exceptions within the mapper will be caught.
     */
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
    /**
     * Identical to {@link #flatRecoverWithErrorHandling(ThrowableFunction)}.
     * @see #flatRecoverWithErrorHandling(ThrowableFunction) */
    public Result<R, Exception> flatMapErrorWithErrorHandling(ThrowableFunction<E, Result<R, Exception>, Exception> mapper) {
        return this.flatRecoverWithErrorHandling(mapper);
    }

    /**
     * Map the currently held exception, if present and matching the class, to a new result.
     * Exceptions within the mapper will be caught.
     * When an Exception of a different class is currently held, the mapper will not be called,
     * and the current result will be returned.
     */
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
    /**
     * Identical to {@link #flatRecoverWithErrorHandling(Class, ThrowableFunction)}.
     * @see #flatRecoverWithErrorHandling(Class, ThrowableFunction) */
    public <ErrorClass extends E> Result<R, Exception> flatMapErrorWithErrorHandling(Class<ErrorClass> c, ThrowableFunction<ErrorClass, Result<R, Exception>, Exception> mapper) {
        return this.flatRecoverWithErrorHandling(c, mapper);
    }

    /**
     * Map the currently held exception, if present, to a different Exception.
     * Exceptions within the mapper will not be caught.
     */
    @SuppressWarnings("unchecked")
    public <E2 extends Exception> Result<R, E2> mapError(Function<E, E2> mapper) {
        if (this.error != null) return Result.error(mapper.apply(this.error));
        return (Result<R, E2>) this;
    }

    /**
     * Map the currently held exception, if present and matching the class, to a different Exception.
     * Exceptions within the mapper will not be caught.
     * When an Exception of a different class is currently held, the mapper will not be called,
     * and the current result will be returned.
     */
    @SuppressWarnings("unchecked")
    public <ErrorClass extends E, E2 extends Exception> Result<R, E2> mapError(Class<ErrorClass> c, Function<ErrorClass, E2> mapper) {
        if (this.error != null && c.isAssignableFrom(this.error.getClass())) return Result.error(mapper.apply(c.cast(this.error)));
        return (Result<R, E2>) this;
    }

    /**
     * Map the currently held exception, if present, to a different Exception.
     * Exceptions within the mapper will not be caught.
     */
    @SuppressWarnings("unchecked")
    public <E2 extends Exception> Result<R, E2> flatMapError(Function<E, Result<R, E2>> mapper) {
        if (this.error != null) return mapper.apply(this.error);
        return (Result<R, E2>) this;
    }

    /**
     * Map the currently held exception, if present and matching the class, to a different Exception.
     * Exceptions within the mapper will not be caught.
     * When an Exception of a different class is currently held, the mapper will not be called,
     * and the current result will be returned.
     */
    @SuppressWarnings("unchecked")
    public <ErrorClass extends E, E2 extends Exception> Result<R, E2> flatMapError(Class<ErrorClass> c, Function<ErrorClass, Result<R, E2>> mapper) {
        if (this.error != null && c.isAssignableFrom(this.error.getClass())) return mapper.apply(c.cast(this.error));
        return (Result<R, E2>) this;
    }

    /**
     * Map the currently held exception, if present, to a different Exception.
     * Exceptions within the mapper will not be caught.
     * When an Exception of a different class is currently held, the mapper will not be called,
     * and the current result will be returned.
     */
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

    /**
     * Map the currently held exception, if present and matching the class, to a different Exception.
     * Exceptions within the mapper will not be caught.
     * When an Exception of a different class is currently held, the mapper will not be called,
     * and the current result will be returned.
     */
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

    public Optional<E> getError() { return Optional.ofNullable(error); }
    public Optional<R> getResult() {
        return Optional.ofNullable(result);
    }
    public R getResult(R defaultValue) { return result == null ? defaultValue : result; }


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

    /** Throw the currently held exception, if present. */
    public Result<R, E> throwIfError() throws E {
        if (this.error != null) throw this.error;
        return this;
    }

    /** Throw the currently held exception, if present and matching the class. */
    public <ErrorClass extends E> Result<R, E> throwIfError(Class<ErrorClass> c) throws ErrorClass {
        if (this.error != null && c.isAssignableFrom(this.error.getClass())) {
            throw c.cast(this.error);
        }
        return this;
    }

    /** Map the currently held exception to a new type, then throw it. */
    @SuppressWarnings("unchecked")
    public <ErrorClass extends Exception> Result<R, ErrorClass> throwIfError(Function<E, ErrorClass> mapper) throws ErrorClass {
        if (this.error != null) throw mapper.apply(this.error);
        return (Result<R, ErrorClass>) this;
    }
}
