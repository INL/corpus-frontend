let next = 0;

export default {
	beforeCreate() {
		(this as any).__uid = (next++).toString();
	},
	computed: {
		uid(): string {
			// @ts-ignore
			return this.__uid as string;
		}
	}
};
