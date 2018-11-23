<template>
	<ul class="pagination pagination-sm">
		<li :class="['first', {'disabled': !prevEnabled}]">
			<span title="first" @click.prevent="changePage(minPage)">&laquo;</span>
		</li>
		<li v-if="prevEnabled" :class="['prev', {'disabled': !prevEnabled}]">
			<span title="previous" @click.prevent="changePage(page-1)">&lsaquo;</span>
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
				@input="$event.target.value = Math.max(minPage+1, Math.min($event.target.value, maxPage+1))"
				@keypress.enter.prevent="isValid($event.target.value-1) ? changePage($event.target.value - 1) : $event.target.value=page+1"
				@keyup.esc.prevent="$event.target.value=page+1; $event.target.blur();"
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
		<li v-if="nextEnabled" :class="['next', {'disabled': !nextEnabled}]">
			<span title="next" @click.prevent="changePage(page+1)">&rsaquo;</span>
		</li>
		<li :class="['last', {'disabled': !nextEnabled}]">
			<span :title="maxPage+1 +' (last)'" @click.prevent="changePage(maxPage)">&raquo;</span>
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
			return this.calcOffsets(this.boundedPage - this.minPage).reverse().map(o => this.boundedPage - o);
		},
		higherPages(): number[] {
			return this.calcOffsets(this.maxPage - this.boundedPage).map(o => this.boundedPage + o);
		},
		nextEnabled(): boolean {
			return this.boundedPage < this.maxPage;
		},
		prevEnabled(): boolean {
			return this.boundedPage > this.minPage;
		},

		boundedPage(): number { return Math.max(this.minPage, Math.min(this.page, this.maxPage)); }
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

<style lang="scss" scoped>
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
			vertical-align: bottom;
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
				z-index: 10;

				&:hover {
					z-index: 0;
				}
			}
			> input {
				border-color: $border-color;
				box-sizing: content-box;
				color: $color;
				border-radius: 0;
				font-size: 12px;
				height: 1.5em;
				line-height: 1.5em;
				padding: 5px;
				position: relative;
				text-align: center;
				width: 36px;
				z-index: 5;

				&:focus,
				&:hover {
					z-index: 15;
				}
				&:not(:focus):not(:hover) {
					-moz-appearance: textfield;
				}
			}
		}
		&.first,
		&.prev,
		&.next,
		&.last {
			> span {
				padding-left: 6px;
				padding-right: 6px;
				box-sizing: content-box;
				width: 6px;
				text-align: center;
				font-weight: bold;
			}
		}
	}
	li+li.current {
		margin-left: -1px;
	}
}
</style>