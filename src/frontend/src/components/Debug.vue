<script lang="ts">
import Vue from 'vue';

import debug from '@/utils/debug';

export default Vue.extend({
	data: () => ({
		debug
	}),
	render(): any {
		return debug ? this.$slots.default : undefined;
	}
});
</script>