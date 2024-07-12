import Vue from 'vue';
import VueI18n, { LocaleMessageObject } from 'vue-i18n';
import { merge } from 'ts-deepmerge';
import { Option } from '@/types/apptypes';
import SelectPicker from '@/components/SelectPicker.vue';
import { localStorageSynced } from '@/utils/localstore';
import { getParallelFieldName } from '@/utils/blacklabutils';


Vue.use(VueI18n);
const defaultLocale = 'en-us';
const locale = localStorageSynced('cf/locale', defaultLocale, true);
const availableLocales: Option[] = Vue.observable([]);

// Language selector will pick up the new entry, after which it can be loaded.
export function registerLocale(locale: string, label: string) {
	availableLocales.push({value: locale, label})
}

const i18n = new VueI18n({
	locale: locale.value,
	fallbackLocale: defaultLocale,
	messages: {},
});
export default i18n;

export async function loadLocaleMessages(locale: string) {
	// also allow loading locales not defined in the availableLocales.
	// This is useful for loading overrides for locales that are not available in the UI.
	// Also, because the UI list can be updated asynchronously (from customjs), we might have a locale in localStorage that is not in the list yet.
	// if it errors, you'll just see the fallbackLocale and a bunch of warnings.

	let messages: LocaleMessageObject|null = null;
	let overrides: LocaleMessageObject|null = null;

	try { messages = await import(`@/locales/${locale}.json`); }
	catch (e) { console.info(`Failed to load builtin locale messages for ${locale}: ${e}`); }

	overrides = await fetch(`${CONTEXT_URL}/${INDEX_ID}/static/locales/${locale}.json`)
		.then(r => {
			if (!r.ok) {
				// If the file doesn't exist, that's fine, we just won't have any overrides.
				// NOTE: browsers will typically log the 404 in the console anyway, there's no way to suppress that from code AFAIK.
				if (r.status !== 404) console.info(`Failed to fetch locale overrides for ${locale}: ${r.statusText}`)
				else console.info(`No locale overrides found for ${locale}. It's safe to ignore the 404 error.`)
				return null;
			} else {
				return r.json();
			}
		})
		.then(r => overrides = r)
		.catch(e => {
			console.warn(`Override ${INDEX_ID}/static/locales/${locale}.json does not appear to be valid JSON! Skipping overrides.`, e)
			return null;
		});

	if (messages || overrides) {
		i18n.setLocaleMessage(locale, merge(messages || {}, overrides || {}));
	} else {
		console.error(`Failed to load locale messages for ${locale}`);
	}
}


registerLocale('en-us', '🇺🇸 English')
registerLocale('zh-cn', '🇨🇳 中文')
registerLocale('nl-nl', '🇳🇱 Nederlands')

loadLocaleMessages(locale.value);

const LocaleSelector = Vue.extend({
	i18n,
	components: { SelectPicker },
	data: () => ({ availableLocales, loading: false, locale }),
	template: `
		<SelectPicker
			class="locale-select navbar-dropdown"
			data-class="btn-link navbar-brand navbar-dropdown-button"
			data-width="auto"
			data-menu-width="auto"
			right
			hideEmpty
			placeholder="🌐"

			:options="availableLocales"
			:loading="loading"
			:showValues="false"
			v-model="locale.value"
		/>`,

	watch: {
		async 'locale.value'() {
			if (!this.$i18n.availableLocales.includes(this.locale.value)) {
				this.loading = true
				await loadLocaleMessages(this.locale.value);
				this.loading = false
			}
			this.$i18n.locale = locale.value
		}
	}
});
new LocaleSelector().$mount('#locale-selector');


/** Get option with correct display name for an annotated field from (custom) locale message bundle,
    or fall back to label in option.  */
export function annotatedFieldOption(i18n: VueI18n, prefix: string, o: Option): Option {
	return {
		...o,
		label: annotatedFieldDisplayName(i18n, getParallelFieldName(prefix, o.value), o.label || o.value),
	};
}

/** Get display name for an annotated field from (custom) locale message bundle,
    or fall back to label in option.  */
export function annotatedFieldDisplayName(i18n: VueI18n, fieldName: string, defaultLabel: string): string {
	const key = `search.annotatedFieldDisplay.${fieldName}`;
	return textOrDefault(i18n, key, defaultLabel);
}

/** Get the i18n text or fall back to a default value if the key doesn't exist.
 *  Useful for dynamic key values such as field names.
 */
export function textOrDefault(i18n: VueI18n, key: string, defaultText: string): string {
	const result = i18n.te(key) ? i18n.t(key) : (i18n.te(key, defaultLocale) ? i18n.t(key, defaultLocale) : defaultText);
	return result.toString();
}