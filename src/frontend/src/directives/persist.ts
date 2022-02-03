import Vue, { VueConstructor } from 'vue';
import {DirectiveOptions, DirectiveFunction, VNodeDirective, VNode} from 'vue';
import { debugLog } from '@/utils/debug';

/**
 * if there is a localstorage value, retrieve it, and assign it
 * if there isn't, persist the value in the following precedence: v-model, value, [el.value | el.checked]
 */

/**
 * v-persist.lazy?="key"
 */

// let namespace = '';

class Persist implements DirectiveOptions {

	constructor(private namespace: string) {}

	// private el: HTMLElement;
	// private key: string;
	// private vnode: VNode;

	public bind: DirectiveFunction = (el, binding, vnode) => {
		const key = binding.arg;
		if (!key) {
			throw new Error('[v-persist]: cannot persist value without key argument!');
		}

		const vBind = vnode.data && vnode.data.directives && vnode.data.directives.find(d => d.name === 'model');
		const lazy = binding.modifiers.lazy;

		if (vBind) {
			vnode.context!.$watch(vBind.expression!, newValue => this.persist(key, newValue));
		} else {
			vnode.context!.$on(lazy ? 'change' : 'input', (event: Event) => this.persist(key, event));
		}

		if (binding.modifiers.delay) {
			Vue.nextTick(() => this.restore(key, el));
		} else {
			this.restore(key, el);
		}
	}

	private persist(key: string, v: any) {
		if (v instanceof Event) {
			v = this.getValue(v.target as HTMLElement);
		}

		debugLog('Persisting', v, 'key', key);
		localStorage.setItem(`${this.namespace}/${key}`, JSON.stringify(v));
	}

	private restore(key: string, el: HTMLElement) {
		let v: any = localStorage.getItem(`${this.namespace}/${key}`);
		if (!v || !(el instanceof HTMLInputElement)) {
			return;
		}

		debugLog('Restoring', v, 'key',  )

		v = JSON.parse(v);
		switch (el.type) {
			case 'checkbox': {
				el.checked = v;
				break;
			}
			case 'radio': {
				if (el.value === v) {
					el.checked = true;
				}
				break;
			}
			case 'file':
			case 'image':
				return;
			default:
				el.value = v;
				break;
		}

		let event: Event;
		if(typeof(Event) === 'function') {
			event = new Event('change');
		}else{
			event = document.createEvent('Event');
			event.initEvent('change', true, true);
		}
		el.dispatchEvent(event);
	}

	private getValue(el: HTMLElement): any {
		if (!(el instanceof HTMLInputElement)) {
			return undefined;
		}

		switch (el.type) {
			case 'checkbox': return el.checked;
			case 'radio': {
				if (el.name != null) {
					const group: NodeListOf<HTMLInputElement> = document.querySelectorAll(`input[type="radio"][name="${el.name}"]:checked`);
					return group.length ? group[0].value : undefined;
				} else {
					return el.checked ? el.value : undefined;
				}
			}
			case 'file':
			case 'image':
				return undefined;
			default:
				return el.value;
		}
	}
}

export default {
	install(vue: VueConstructor, options: {
		namespace?: string
	}) {
		vue.directive('persist', new Persist(options.namespace || ''));
	}
};
