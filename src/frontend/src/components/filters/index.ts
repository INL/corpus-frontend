import { PluginObject } from 'vue';

import FilterAutocomplete from './FilterAutocomplete.vue';
import FilterCheckbox from './FilterCheckbox.vue';
import FilterRadio from './FilterRadio.vue';
import FilterRange from './FilterRange.vue';
import FilterSelect from './FilterSelect.vue';
import FilterText from './FilterText.vue';

const filterPlugin: PluginObject<never> = {
	install(vue) {
		vue.component('filter-autocomplete', FilterAutocomplete);
		vue.component('filter-checkbox', FilterCheckbox);
		vue.component('filter-radio', FilterRadio);
		vue.component('filter-range', FilterRange);
		vue.component('filter-select', FilterSelect);
		vue.component('filter-text', FilterText);
	}
};

export default filterPlugin;
