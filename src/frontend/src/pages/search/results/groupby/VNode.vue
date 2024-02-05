<script lang="ts">
import Vue from 'vue';
export default Vue.extend({
	functional: true,
	// @ts-ignore
	render: (h, ctx) => ctx.props.vnode
});
</script>