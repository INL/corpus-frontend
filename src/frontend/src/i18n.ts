import Vue from 'vue';
import VueI18n from 'vue-i18n';

const messages: VueI18n.LocaleMessages = {
	en: {
        "hello": "Hello World!"
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