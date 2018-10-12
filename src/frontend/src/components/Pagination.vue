<template>
	<ul class="pagination pagination-sm">
		<li :class="['prev', {'disabled': !prevEnabled}]">
			<span title="previous" @click.prevent="changePage(page-1)">&laquo;</span>
		</li>
		<li v-for="i in lowerPages" :key="i">
			<span @click.prevent="changePage(i)">{{i+1}}</span>
		</li>
		<li v-if="lowerPages.length || higherPages.length" class="current">
			<input
				type="number"
				class="form-control"

				:value="page+1"
				:min="minPage+1"
				:max="maxPage+1"
				@keypress.enter.prevent="isValid($event.target.value-1) ? changePage($event.target.value - 1) : $event.target.value=page+1"
				@change.prevent="isValid($event.target.value-1) ? changePage($event.target.value-1) : $event.target.value=page+1"
				ref="maincontrol"
			/>
			<span class="fa fa-pencil"></span>
		</li>
		<li v-else class="disabled"> <!-- no available pages -->
			<span>{{page+1}}</span>
		</li>
		<li v-for="i in higherPages" :key="i">
			<span @click.prevent="changePage(i)">{{i+1}}</span>
		</li>
		<li :class="['next', {'disabled': !nextEnabled}]">
			<span title="next" @click.prevent="changePage(page+1)">&raquo;</span>
		</li>
	</ul>
</template>

<script lang="ts">
import Vue from 'vue';

/** Renders pagination controls, inputs are 0-based, meaning page === 0 will render as 1 on the label */
export default Vue.extend({
	props: {
		page: Number as () => number,
		maxPage: {
			type: Number as () => number,
			default: Number.MAX_VALUE,
		},
		minPage: {
			type: Number as () => number,
			default: 0,
		},
	},
	data: () => ({
		focus: false,
	}),
	computed: {
		lowerPages(): number[] {
			return this.calcOffsets(this.page - this.minPage).reverse().map(o => this.page - o);
		},
		higherPages(): number[] {
			return this.calcOffsets(this.maxPage - this.page).map(o => this.page + o);
		},
		nextEnabled(): boolean {
			return this.page < this.maxPage;
		},
		prevEnabled(): boolean {
			return this.page > this.minPage;
		}
	},
	methods: {
		calcOffsets(range: number) {
			if (range <= 0) return [];
			if (range <= 1) return [1];
			if (range <= 2) return [1,2];
			if (range <= 5) return [1,2,range];
			if (range <= 10) return [1,2,5,range];
			return [1,2,3,5,10];
		},
		isValid(page: any): page is number {
			return typeof page === 'number' &&
				!isNaN(page) &&
				page !== this.page &&
				page >= this.minPage &&
				page <= this.maxPage
		},
		changePage(page: any) {
			if (this.isValid(page)) {
				this.$emit('change', page)
			}
		}
	},
	beforeUpdate() {
		this.focus = document.activeElement === this.$refs.maincontrol
	},
	updated() {
		if (this.focus) {
			(this.$refs.maincontrol as HTMLInputElement).focus();
		}
	},

})
</script>

<style lang="scss">
.pagination {

	$color: darken(#337ab7, 5);
	$border-color: lighten(#337ab7, 20);
	margin: 0;
	font-size: 0;

	>li {
		display: inline-block;
		> span {
			cursor: pointer;
			display: inline-block;
			float: none;
			user-select: none;
		}
		&.current {
			color: #555;
			position: relative;
			> .fa {
				align-items: center;
				background: none;
				border: none;
				bottom: 2px;
				color: $color;
				display: flex;
				justify-content: center;
				margin: 0;
				opacity: 0.8;
				padding: 0;
				position: absolute;
				right: 6px;
				top: 0;
				z-index: 2;

				&:hover {
					z-index: 0;
				}
			}
			> input {
				border-color: $border-color;
				color: $color;
				border-radius: 0;
				font-size: 12px;
				height: auto;
				line-height: 1.5;
				padding: 5px;
				position: relative;
				text-align: center;
				width: 46px;
				z-index: 1;

				&:focus,
				&:hover {
					z-index: 3;
				}
			}
		}
		&.next,
		&.prev {
			> span {
				padding-left: 6px;
				padding-right: 6px;
			}
		}
	}
	li+li.current {
		margin-left: -1px;
	}
}
</style>