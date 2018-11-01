/* Extend this a little as the @types/bootstrap-select package is a little bare and causes warnings */

interface JQuery {
	selectpicker(opts?: BootstrapSelectOptions): JQuery
	selectpicker(method: 'val'): string|string[]
	selectpicker(method: 'val', ...args: Array<string | Array<string>>): JQuery
	selectpicker(method: string): JQuery
}
