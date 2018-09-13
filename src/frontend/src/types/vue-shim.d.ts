/**
 * Make typescript pretend that a .vue file always default exports a Vue component
 * This is required because otherwise the compiler complains it can't find the module (because it doesn't/can't parse the file)
 */
declare module "*.vue" {
    import Vue from "vue";
    export default Vue;
}