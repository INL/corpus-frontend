import Vue from 'vue';
import VueI18n, { LocaleMessageObject } from 'vue-i18n';
import { merge } from 'ts-deepmerge';
import { Option } from '@/types/apptypes';
import SelectPicker from '@/components/SelectPicker.vue';
import { localStorageSynced } from '@/utils/localstore';


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
	catch (e) { console.info(`Failed to load locale messages for ${locale}: ${e}`); }

	overrides = await fetch(`${CONTEXT_URL}/${INDEX_ID}/static/locales/${locale}.json`)
		.then(r => {
			if (!r.ok) {
				// If the file doesn't exist, that's fine, we just won't have any overrides.
				// NOTE: browsers will typically log the 404 in the console anyway, there's no way to suppress that from code AFAIK.
				if (r.status !== 404) console.info(`Failed to fetch locale overrides for ${locale}: ${r.statusText}`)
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
	template: `<SelectPicker :options="availableLocales" v-model="locale.value" :loading="loading" data-width="auto" right data-menu-width="auto" hideEmpty :showValues="false" placeholder="🌐" class="locale-select" data-class="btn-link navbar-brand locale-select-button"/>`,

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