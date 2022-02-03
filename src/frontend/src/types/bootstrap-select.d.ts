/* Extend this a little as the @types/bootstrap-select package is a little bare and causes warnings */

interface BootstrapSelect<T = HTMLElement> {
	(opts?: BootstrapSelectOptions): JQuery<T>
	(method: 'val'): string|string[]
	(method: 'val', ...args: Array<string | Array<string>>): JQuery<T>
	(method: string): JQuery<T>
}
