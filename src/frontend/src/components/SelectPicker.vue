<template>
	<div class="combobox" :style="{ width: dataWidth }"
		:data-menu-id="menuId"

		@keydown.prevent.down="focusDown"
		@keydown.prevent.up="focusUp"
	>
		<input v-if="editable"
			:class="['menu-input', dataClass ? dataClass : 'form-control']"
			:style="dataStyle"
			:title="dataTitle"
			:placeholder="$attrs.placeholder || $attrs.title"
			:disabled="disabled"

			@focus="open"
			@keydown.tab="close()/*focus shifts to next element, close menu*/"
			@keydown.esc="close()"
			@keydown.enter="close()"

			@input.stop="$emit('input', $event.target.value); emitChangeOnClose = true"
			@change.stop=""

			v-model="inputValue"

			ref="focusOnEscClose"
		/>
		<button v-else
			type="button"

			:class="['menu-button', 'btn', dataClass ? dataClass : 'btn-default', { 'active': isOpen }]"
			:style="dataStyle"
			:title="dataTitle"
			:disabled="disabled"

			@click="isOpen ? close() : open()"
			@keydown.tab="close()/*focus shifts to next element, close menu*/"
			@keydown.esc="close()"
			@keydown.prevent.enter="$event.target.click()/*stop to prevent submitting any parent form*/"

			ref="focusOnEscClose"
		>
			<template v-if="displayValues.length">
				<span class="menu-value" v-if="allowHtml" v-html="displayValues.join(', ')"/>
				<span class="menu-value" v-else :title="displayValues.join(',')">{{displayValues.join(', ')}}</span>
			</template>
			<span v-else class="menu-value placeholder">{{$attrs.placeholder || $attrs.title || 'Select a value...'}} </span>
			<span :class="['menu-icon', 'fa', `fa-caret-${isOpen ? 'up' : 'down'}`]"/>
		</button>

		<!-- NOTE: might not actually be a child of root element at runtime! Event handling is rather specific -->
		<ul class="combobox-menu" v-show="isOpen && !(editable && !filteredOptions.length)"
			:data-menu-id="menuId"

			@keydown.prevent.stop.esc="$refs.focusOnEscClose.focus(); close(); /* order is important */"
			@keydown.prevent.stop.down="focusDown"
			@keydown.prevent.stop.right="focusDown"
			@keydown.prevent.stop.up="focusUp"
			@keydown.prevent.stop.left="focusUp"
			@keydown.prevent.stop.tab="$event.shiftKey ? focusUp() : focusDown()"

			ref="menu"
		>
			<li class="menu-header"><button v-if="resettable"
				type="button"
				class="btn btn-sm btn-default menu-reset"
				tabindex="-1"

				@click="internalModel = {}; inputValue=''"
			>Reset</button><input v-if="searchable && !editable /* When it's available, edit box handles searching */"
				type="text"
				class="form-control input-sm menu-search"
				placeholder="Filter..."
				tabindex="-1"

				@keydown.stop.left="/*stop menu from changing focus here*/"
				@keydown.stop.right="/*stop menu from changing focus here*/"
				@keydown.prevent.enter="/*prevent submission when embedded in a form*/"

				v-model="inputValue"
			/></li>

			<li class="menu-body">
				<ul class="menu-options">
					<li v-if="!filteredOptions.length" class="menu-option disabled">
						<em class="menu-value">No available options.</em>
					</li>
					<template v-for="o in filteredOptions">
					<li v-if="o.type === 1"
						:class="['menu-option', {
							'selected': internalModel[o.id] && !multiple,
							'disabled': o.disabled,
						}]"
						:key="o.id"
						:tabindex="o.disabled ? undefined : -1"
						:title="o.title"
						:data-value="o.value"

						@click="select(o); emitChangeOnClose = true;"
						@keydown.prevent.enter="select(o); emitChangeOnClose = true;"
						@keydown.prevent.space="select(o); emitChangeOnClose = true;"
					>
						<span v-if="allowHtml || !o.label || !o.label.trim()" class="menu-value" v-html="o.label && o.label.trim() ? o.label : '&nbsp;'"/>						<span v-else class="menu-value">{{o.label || ' '}}</span>
						<span v-if="multiple && internalModel[o.id]" class="menu-icon fa fa-check"/>
					</li>
					<li v-else-if="o.type === 2"
						:class="['menu-group', {
							'disabled': o.disabled,
						}]"
						:key="o.index + o.label"
						:title="o.title"
					>
						<span v-if="allowHtml" class="menu-value" v-html="o.label"/> <!-- don't nbsp fallback here, we want the height to collapse if there's no label -->
						<span v-else class="menu-value">{{o.label || ' '}}</span>
					</li>
					</template>
				</ul>
			</li>
		</ul>
	</div>

</template>

<script lang="ts">
import Vue from 'vue';

// import {debugLog} from '@/utils/debug';

export type SimpleOption = string;

export type Option = {
	value: string;
	label?: string;
	title?: string;
	disabled?: boolean;
};
export type OptGroup = {
	label?: string;
	title?: string;
	disabled?: boolean;
	options: Array<string|Option>;
};

type _uiOpt = {
	type: 1;
	id: number;

	value: string;
	label: string;

	disabled?: boolean;
	title?: string;

	lowerValue: string;
	lowerLabel: string;
}
type _uiOptGroup = {
	type: 2;

	label?: string;
	title?: string;
	disabled?: boolean;
}
type uiOption = _uiOpt|_uiOptGroup;

type Model = {
	[key: string]: _uiOpt;
}

function isSimpleOption(e: any): e is string { return typeof e === 'string'; }
function isOption(e: any): e is Option { return e && isSimpleOption(e.value); }
function isOptGroup(e: any): e is OptGroup { return e && typeof e.label === 'string' && Array.isArray(e.options); }

let id = 0;

export default Vue.extend({
	props: {
		options: Array as () => Array<string|Option|OptGroup>,
		multiple: Boolean,
		/** Is the dropdown list filtered by the current value (acts more as an autocomplete) */
		searchable: Boolean,
		/** Allow custom values by the user? */
		editable: Boolean,
		/** Show reset button at top of menu? */
		resettable: Boolean,
		disabled: Boolean,

		allowHtml: Boolean,
		hideDisabled: Boolean,
		/** Hide the default empty value for non-multiple dropdowns */
		hideEmpty: Boolean,
		/** Queryselector for menu container */
		container: String,

		value: [String, Array] as any as () => string|string[]|null,

		/** attached to top-level container */
		'data-width': String,
		/** attached to main input/button */
		'data-class': [String, Object],
		'data-style': [String, Object],
		'data-title': String,
 	},
	data: () =>  ({
		isOpen: false,
		emitChangeOnClose: false,

		/** Search/custom input value, role depends on editable, searchable */
		inputValue: '',

		internalModel: {} as Model,

		// Can't be computed, need to wait until we are mounted
		// (as container might be a parent element that hasn't fully mounted yet when we init)
		containerEl: null as null|HTMLElement,

		uid: id++
	}),
	computed: {
		menuId(): string { return this.$attrs.id != null ? this.$attrs.id : `combobox-${this.uid}`},

		uiOptions(): uiOption[] {

			const mapSimple = (o: SimpleOption, i: number, group?: OptGroup): _uiOpt => ({
				type: 1,
				id: i,

				label: o,
				value: o,
				title: o,

				disabled: group && group.disabled,

				lowerValue: o.toLowerCase(),
				lowerLabel: o.toLowerCase(),
			});

			const mapOption = (o: Option, i: number, group?: OptGroup): _uiOpt => ({
				type: 1,
				id: i,

				value: o.value,
				label: o.label || o.value,
				title: o.title,

				disabled: o.disabled || (group && group.disabled),

				lowerValue: o.value.toLowerCase(),
				lowerLabel: (o.label || o.value).toLowerCase()
			});

			const mapGroup = (o: OptGroup): _uiOptGroup => ({
				type: 2,
				label: o.label,
				title: o.title,
				disabled: o.disabled,
			});

			let i = 0;
			let uiOptions = this.options.flatMap(o => {
				if (isSimpleOption(o)) return mapSimple(o, i++);
				else if (isOption(o)) return mapOption(o, i++);
				else {
					const h = mapGroup(o);
					const subs: uiOption[] = o.options.map(sub => isSimpleOption(sub) ? mapSimple(sub, i++, o) : mapOption(sub, i++, o));
					subs.unshift(h);
					return subs;
				}
			});

			// prepend an empty valued option if there is none and the user can't untick values otherwise
			if (!this.multiple && !this.editable && !this.hideEmpty && !uiOptions.some(o => o.type === 1 && o.value === '')) {
				const emptyOption: _uiOpt = {
					type: 1,
					id: -1,
					value: '',
					label: '',
					lowerValue: '',
					lowerLabel: '',
				}

				uiOptions.unshift(emptyOption);
			} else if (this.multiple || this.editable) {
				// remove all empty options if the user can edit or otherwise untick values
				uiOptions = uiOptions.filter(o => !(o.type === 1 && !o.value && !o.label))
			}

			return uiOptions;
		},
		filteredOptions(): uiOption[] {
			let options = this.uiOptions;
			if (this.hideDisabled) {
				let inDisabledGroup = false;
				options = options.filter(o => {
					if (o.type === 2) {
						inDisabledGroup = !!o.disabled;
					}
					return !(o as any).disabled && !inDisabledGroup;
				})
			}

			const filter = this.inputValue;
			if (!filter) { return options; }

			let hideNextOptGroup = true;
			return options.filter(o => {
				return o.type !== 1 || o.lowerLabel.includes(filter) || o.lowerValue.includes(filter);
			})
			.reverse()
			.filter(o => {
				if (o.type === 2 && hideNextOptGroup) return false;
				hideNextOptGroup = o.type !== 1;
				return true;
			})
			.reverse();
		},

		///////////////

		displayValues(): string[] { return Object.values(this.internalModel).map(v => v.label || v.value); },
	},
	methods: {
		open(): void {
			this.isOpen = true;
		},
		close(event?: Event): void {
			function isChild(parent: HTMLElement, child: HTMLElement|null) {
				do {
					if (!child) { return false; }
					if (child === parent) { return true; }
				} while (child = child.parentElement)
			}

			if (event && event.type === 'click') {
				const isOwnMenuClick = isChild(this.$refs.menu as HTMLElement, event.target! as HTMLElement);
				// NOTE: assumes the template doesn't render a button as main interactable when this.editable is true
				const isOwnInputClick = this.editable && isChild(this.$el, event.target! as HTMLElement);
				if (isOwnMenuClick || isOwnInputClick) {
					return;
				}
			}

			// reset option search/filter string
			if (!this.editable) {
				this.inputValue = '';
			}
			this.isOpen = false;
		},
		reposition(): void {
			if (!this.containerEl) { return; }

			const menu = this.$refs.menu as HTMLElement;
			const container = this.containerEl!;

			const {left: containerLeft, top: containerTop} = container.getBoundingClientRect();
			const {left: ownLeft, bottom: ownBottom, top: ownTop} = this.$el.getBoundingClientRect();

			const width = this.$el.offsetWidth;
			const left = ownLeft - containerLeft;
			const top = ownBottom - containerTop;

			menu.style.transform = `translate(${left}px, ${top}px)`;
			menu.style.width = width + 'px';
		},
		focusDown(): void {this.focusOffset(1); },
		focusUp(): void { this.focusOffset(-1); },
		focusOffset(offset: number): void {
			const menu = this.$refs.menu as HTMLElement;
			const items = [...menu.querySelectorAll('[tabindex]')];
			if (!items.length) {
				return;
			}

			const focusIndex = this.loopingIncrementor(items.findIndex(e => e === document.activeElement), items.length, offset).next();
			this.focus(items[focusIndex] as HTMLElement);
		},
		focus(el: HTMLElement): void {
			if (!this.isOpen) {
				this.open();
				Vue.nextTick(() => el.focus());
			} else {
				 el.focus();
			}
		},

		select(opt: _uiOpt): void {
			const {id, value, disabled} = opt;
			if (disabled) {
				return;
			}

			if (this.editable) {
				this.inputValue = value;
				this.$emit('input', value);
				this.close();
				return;
			}

			// regular select, highlight the node, store in model, etc
			if (this.multiple) {
				if (this.internalModel[id]) {
					Vue.delete(this.internalModel, id as any as string);
				} else if (value) {
					Vue.set(this.internalModel, id as any as string, opt);
				}
			} else {
				this.internalModel = {};
				if (value) {
					Vue.set(this.internalModel, id as any as string, opt);
				}
			}

			if (this.isOpen && !this.multiple) {
				this.close();
			}
		},
		submit() {
			this.close();
		},

		//////////////////
		addGlobalListeners() { this.addGlobalCloseListeners(); this.addGlobalScrollListeners(); },
		removeGlobalListeners() { this.removeGlobalCloseListeners(); this.removeGlobalScrollListeners(); },
		addGlobalCloseListeners() { document.addEventListener('click', this.close); },
		removeGlobalCloseListeners() { document.removeEventListener('click', this.close); },
		addGlobalScrollListeners() {
			window.addEventListener('resize', this.reposition);
			for (let parent = this.$el && this.$el.parentElement; parent != null; parent = parent.parentElement) {
				parent.addEventListener('scroll', this.reposition);
			}
		},
		removeGlobalScrollListeners() {
			window.removeEventListener('resize', this.reposition);
			for (let parent = this.$el && this.$el.parentElement; parent != null; parent = parent.parentElement) {
				parent.removeEventListener('scroll', this.reposition);
			}
		},

		loopingIncrementor(initial: number, max: number, increment: number) {
			let cur = initial;
			return {
				next() {
					const next = (cur + increment) % max;
					cur = next < 0 ? next + max : next;
					return cur;
				},
				get current() { return cur; }
			};
		},

	},
	watch: {
		isOpen: {
			immediate: true,
			handler(cur: boolean, prev: boolean) {
				cur ? this.addGlobalListeners() : this.removeGlobalListeners();
				if (cur && this.containerEl) { this.reposition(); }

				if (!cur && this.emitChangeOnClose) {
					this.emitChangeOnClose = false;
					this.$emit('change', this.editable ? this.inputValue : Object.values(this.internalModel).map(o => o.value));
				}
			}
		},
		// Not immediate on purpose, first change is done in mounted()
		container(v: string) {
			return v ? document.querySelector(v) : null;
		},
		containerEl: {
			immediate: true,
			handler(cur: HTMLElement|null, prev: HTMLElement|null) {
				if (this.isOpen) {
					if (prev) { this.removeGlobalScrollListeners(); }
					if (cur) { this.addGlobalScrollListeners(); }
				}

				if (cur) {
					// Vue.nextTick(() => {
						cur.appendChild(this.$refs.menu as HTMLElement);
						if (this.isOpen) {
							this.reposition();
						}
					// });
				};
			}
		},
		// TODO
		value: {
			immediate: true,
			handler(newVal: string|string[]|null, oldVal: string|string[]|null) {
				if (this.editable) {
					this.inputValue = (newVal ? typeof newVal === 'string' ? newVal : newVal[0] || '' : '');
					return;
				};

				if (newVal == null) { newVal = this.multiple ? [] : ''; }
				else if (this.multiple && typeof newVal === 'string') { newVal = [newVal]; }
				else if (!this.multiple && Array.isArray(newVal)) { newVal = newVal[0] || ''; }

				if (!this.multiple) {
					newVal = newVal as string; // we verified above, but can't declare it to be a type...

					// Assume model always in a consistent state - e.g. no multiple values when !this.multiple
					const cur = Object.values(this.internalModel)[0] as _uiOpt|undefined;
					const newOption = newVal ? (cur && cur.value === newVal) ? cur : this.uiOptions.find(o => o.type === 1 && o.value === newVal) as _uiOpt : undefined;
					if (newOption !== cur) {
						this.internalModel = newOption ? { [newOption.id]: newOption } : {};
					}
				} else {
					// We need to be smart about this to prevent infinite loops or double $emits when updating

					// First split the currently selected options into two categories: those still selected, and those no longer selected
					// Then find the corresponding option object for all new values that weren't selected yet
					// Then check whether we need to update the model (any deselections or new selections) and rewrite it
					// NOTE: new values for which no corresponding option exists are ignored, and will not be removed until an option that actually exists is toggled.

					const unselectedValues = [] as _uiOpt[];
					let newSelectedValues: any[] = (newVal as string[]).concat(); // copy, don't edit values from a parent! currently string[]
					const alreadySelectedValues = Object.values(this.internalModel)
					.filter(o => {
						const indexInNew = (newSelectedValues as string[]).indexOf(o.value);
						if (indexInNew !== -1) {
							// already have this, so it's not a new option
							(newSelectedValues as string[]).splice(indexInNew, 1);
							return true;
						}

						unselectedValues.push(o);
						return false;
					});

					if (newSelectedValues.length) {
						const allOptions = this.uiOptions.filter(o => o.type === 1) as _uiOpt[];
						// map to _uiOpt[]
						newSelectedValues = newSelectedValues.map(v => allOptions.find(o => o.value === v && !alreadySelectedValues.includes(o)))
						.filter(v => !!v); // remove invalid values that were mapped to undefined
					}

					// debugLog('updating multiselect', 'old values', oldVal,  'new values', newVal, 'unselected', unselectedValues, 'new selected', newSelectedValues);
					for (let v of unselectedValues) { Vue.delete(this.internalModel, v.id.toString()); }
					for (let v of newSelectedValues as _uiOpt[]) { Vue.set(this.internalModel, v.id.toString(), v); }
				}
			}
		},
		internalModel() {
			// Model only updated when required, see value prop watcher above
			// So if this triggers we know for sure the value output also needs to change
			const values = Object.values(this.internalModel).map(v => v.value);
			if (this.multiple) {
				this.$emit('input', values);
			} else {
				this.$emit('input', values[0] || '');
			}
		},

		editable(v: boolean) { if (!v && !this.searchable) this.inputValue = '' },
		searchable(v: boolean) { if (!v && !this.editable) this.inputValue = ''},
	},
	created() {
		if (this.editable && this.multiple) {
			throw new Error("Editable not supported with multiple");
		}
	},
	mounted() {
		// Only do this when mounted, the container selector may refer to a parent element
		// And we need to wait for it to mount before we can select it and attach to it
		if (this.container) {
			this.containerEl = document.querySelector(this.container);
		}
	},
	beforeDestroy() {
		this.removeGlobalListeners();
		// In case container has been set.
		(this.$refs.menu as HTMLElement).remove();
	},
});

</script>

<style lang="scss">

.combobox,
.combobox-menu {
	.menu-value {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.menu-icon {
		display: inline-block;
		flex: none;
		margin-left: 4px;
	}
	.placeholder {
		color: #999;
	}
}

.combobox {
	text-align: left;
	// Bootstrap helper
	&:not(.input-group-btn):not(.input-group-addon) {
		display: inline-block;
		position: relative;
		width: 220px; // just some default

		>.menu-button {
			width: 100%;
		}
	}
	&.input-group-btn:first-child,
	&.input-group-addon:first-child {
		>.menu-button { border-right-width: 0; }
	}

	>.menu-button {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
	}

	>.combobox-menu { top: auto; }
}

.combobox-menu {
	background: white;
	border: 1px solid #e5e5e5;
	border-radius: 4px;
	box-shadow: 0 6px 12px rgba(0,0,0,.175);
	font-size: 14px;
	left: 0;
	margin-top: 3px;
	max-width: 100%;
	min-width: 150px;
	overflow-y: auto;
	padding: 5px 0;
	position: absolute;
	text-align: left;
	top: 0;
	width: 100%;
	z-index: 1000;

	ul {
		padding: 0;
		margin: 0;
		list-style: none;
	}

	>.menu-header {
		border-bottom: 1px solid #e5e5e5;
		display: block;
		margin: -5px 0 3px; //offset padding at top of .menu
		padding: 6px;

		&:empty { display: none; }

		>.menu-reset {
			display: block;
			width: 100%;
			&+.menu-search { margin-top: 6px; }
		}
		>.menu-search {
			width: 100%;
			display: block;
		}
	}
	>.menu-body {
		display: block;
		max-height: 300px;
		overflow: auto;

		>.menu-options {
			>.menu-option {
				align-items: baseline;
				justify-content: space-between;
				color: #333;
				cursor: pointer;
				display: flex;
				padding: 4px 12px 4px 22px;
				white-space: nowrap;
				width: 100%;

				&.selected {
					background: #337ab7;
					color: white;
					.text-muted { color :white; }
				}

				&.disabled {
					color: #777;
					cursor: not-allowed;
				}

				&:not(.selected):not(.disabled) {
					&:hover,
					&:focus,
					&:active {
						background: #ddd;
						color: #262626;
					}
				}
			}
			>.menu-group {
				border-bottom: 1px solid #e5e5e5;
				color: #777;
				display: flex;
				font-size: 12px;
				margin-bottom: 3px;
				padding: 8px 0px 4px 12px;
				width: 100%;

				&.disabled {
					color: #777;
					cursor: not-allowed;
				}
			}
		}
	}
}

</style>