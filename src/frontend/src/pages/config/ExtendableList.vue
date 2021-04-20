<script lang="ts">
import Vue from 'vue';

export default Vue.extend({
	props: {
		value: Array as () => string[]
	},
	methods: {
		addEntry(e: string) { this.$emit('input', this.value.concat(e.trim())); },
		removeEntry(i: number) { this.$emit('input', this.value.filter((e, index) => index !== i)); },
	},
	render(): any {
		return this.$scopedSlots.default!({
			entries: this.value,
			addEntry: this.addEntry
		})
	},
	created() {

	}
})

</script>