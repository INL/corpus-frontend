<script lang="ts">
import Vue from 'vue';

import debug from '@/utils/debug';

export default Vue.extend({
	render(): any {
		return debug.debug ? this.$slots.default : undefined;
	}
});
</script>