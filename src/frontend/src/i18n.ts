import Vue from 'vue';
import VueI18n from 'vue-i18n';

const messages: VueI18n.LocaleMessages = {
	en: {
        "hello": "Hello World!",
		"inSourceVersionHeading": "in source version",
		"andCompareWithTargetVersionsHeading": "and compare with target version(s)",
	},
    nl: {
        "hello": "Hallo Wereld!"
    }
};

Vue.use(VueI18n);
export default new VueI18n({
	locale: 'en',
	messages
});