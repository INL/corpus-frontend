let next = 0;

export default {
	beforeCreate() {
		(this as any).uid = (next++).toString();
	}
};
