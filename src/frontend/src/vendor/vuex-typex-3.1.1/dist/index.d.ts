import { Module, Store, StoreOptions, Plugin } from "vuex";
export declare type MutationHandler<S, P> = (state: S, payload: P) => void;
export declare type ActionHandler<S, R, P, T> = (context: BareActionContext<S, R>, payload: P) => Promise<T> | T;
export declare type GetterHandler<S, R, T> = (state: S, rootState: R) => T;
export interface BareActionContext<S, R> {
    state: S;
    rootState: R;
}
export interface ModuleBuilder<S, R = {}> {
    /** The namespace of this ModuleBuilder */
    readonly namespace: string;
    /** Creates a strongly-typed nested module within this module */
    module<M>(namespace: string, initialState: M): ModuleBuilder<M, R>;
    /** Gets an existing nested module within this module */
    module<M>(namespace: string): ModuleBuilder<M, R>;
    /** Set the initial state for an existing module */
    setInitialState(initialState: S): void;
    /** Creates a strongly-typed commit function for the provided mutation handler */
    commit<P>(handler: MutationHandler<S, void>): () => void;
    commit<P>(handler: MutationHandler<S, P>): (payload: P) => void;
    commit<P>(handler: MutationHandler<S, void>, name: string): () => void;
    commit<P>(handler: MutationHandler<S, P>, name: string): (payload: P) => void;
    /** Creates a strongly-typed dispatch function for the provided action handler */
    dispatch<P, T>(handler: ActionHandler<S, R, void, void>): () => Promise<void>;
    dispatch<P, T>(handler: ActionHandler<S, R, P, void>): (payload: P) => Promise<void>;
    dispatch<P, T>(handler: ActionHandler<S, R, void, T>): () => Promise<T>;
    dispatch<P, T>(handler: ActionHandler<S, R, P, T>): (payload: P) => Promise<T>;
    dispatch<P, T>(handler: ActionHandler<S, R, void, void>, name: string): () => Promise<void>;
    dispatch<P, T>(handler: ActionHandler<S, R, P, void>, name: string): (payload: P) => Promise<void>;
    dispatch<P, T>(handler: ActionHandler<S, R, void, T>, name: string): () => Promise<T>;
    dispatch<P, T>(handler: ActionHandler<S, R, P, T>, name: string): (payload: P) => Promise<T>;
    /** Creates a strongly-typed read function for the provided getter function */
    read<T>(handler: GetterHandler<S, R, T>): () => T;
    read<T>(handler: GetterHandler<S, R, T>, name: string): () => T;
    /** Creates a method to return this module's state */
    state(): () => S;
    /** Output a Vuex Module definition. Called after all strongly-typed functions have been obtained */
    vuexModule(): Module<S, R>;
    _provideStore(store: Store<R>): void;
}
export interface VuexStoreOptions<R> {
    plugins?: Plugin<R>[];
}
export interface StoreBuilder<R> {
    /** Creates a ModuleBuilder for the namespace provided */
    module<S>(namespace: string, state: S): ModuleBuilder<S, R>;
    /** Gets an existing ModuleBuilder for the namespace provided */
    module<S>(namespace: string): ModuleBuilder<S, R>;
    /** Output a Vuex Store after all modules have been built */
    vuexStore(): Store<R>;
    /** Output a Vuex Store and provide options, e.g. plugins -- these take precedence over any auto-generated options */
    vuexStore(overrideOptions: StoreOptions<R>): Store<R>;
    /** Creates a strongly-typed commit function for the provided mutation handler */
    commit<P>(handler: MutationHandler<R, void>): () => void;
    commit<P>(handler: MutationHandler<R, P>): (payload: P) => void;
    commit<P>(handler: MutationHandler<R, void>, name: string): () => void;
    commit<P>(handler: MutationHandler<R, P>, name: string): (payload: P) => void;
    /** Creates a strongly-typed dispatch function for the provided action handler */
    dispatch<P, T>(handler: ActionHandler<R, R, void, void>): () => Promise<void>;
    dispatch<P, T>(handler: ActionHandler<R, R, P, void>): (payload: P) => Promise<void>;
    dispatch<P, T>(handler: ActionHandler<R, R, void, T>): () => Promise<T>;
    dispatch<P, T>(handler: ActionHandler<R, R, P, T>): (payload: P) => Promise<T>;
    dispatch<P, T>(handler: ActionHandler<R, R, void, void>, name: string): () => Promise<void>;
    dispatch<P, T>(handler: ActionHandler<R, R, P, void>, name: string): (payload: P) => Promise<void>;
    dispatch<P, T>(handler: ActionHandler<R, R, void, T>, name: string): () => Promise<T>;
    dispatch<P, T>(handler: ActionHandler<R, R, P, T>, name: string): (payload: P) => Promise<T>;
    /** Creates a strongly-typed read function for the provided getter function */
    read<T>(handler: GetterHandler<R, R, T>): () => T;
    read<T>(handler: GetterHandler<R, R, T>, name: string): () => T;
    /** Creates a method to return the root state */
    state(): () => R;
    /** WARNING: Discards vuex store and reset modules (non intended for end-user use) */
    reset(): void;
}
/** Get a reference to the default store builder */
export declare function getStoreBuilder<R>(): StoreBuilder<R>;
/** Get a reference to a named store builder */
export declare function getStoreBuilder<R>(name: string): StoreBuilder<R>;
