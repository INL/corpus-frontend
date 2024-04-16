<template>
	<div class="username navbar-username navbar-brand" v-if="enabled">
		<!-- bootstrap 3 caret with with logout button in dropdown -->
		<div class="dropdown" v-if="canLogin">
			<a href="#" class="dropdown-toggle" data-toggle="dropdown">
				<span class="fa fa-solid fa-user"></span>
				<span class="username">{{username || 'Not logged in'}}</span>
				<span class="caret"></span>
			</a>
			<ul class="dropdown-menu pull-left" style="z-index: 10000; transform: none; position: absolute;">
				<li><a href="#" role="button" @click="username ? $emit('logout') : $emit('login')">Log {{username ? 'out' : 'in'}}</a></li>
			</ul>
		</div>
		<!-- if there's no username, and we can't login, don't bother showing anything -->
		<div v-else-if="username">
			<span class="fa fa-solid fa-user"></span>
			<span class="username">{{ username }}</span>
		</div>
	</div>
</template>

<script lang="ts">
import Vue from 'vue';

export default Vue.extend({
	props: {
		enabled: {
			type: Boolean,
			default: false,
		},
		canLogin: Boolean,
		username: String as () => string|undefined,
	},
})

</script>

<style lang="scss">


.navbar-username {
	position: absolute;
	right: 0;
	top: 0;
	flex: none;
	flex-basis: 0;
	white-space: nowrap;
}


.navbar-username { display: inline-flex; }
.navbar-username:empty { display: none; }
.navbar-username > .username { order: 2; }
.navbar-username > .username:empty { display: none;}
.username-icon {
	order: 1;
	margin-right: 0.25em;
}

.username:empty + .username-icon {
	display: none;
}


@media (max-width: 768px) {
	.navbar-username {
		right: 50px;
	}
}


</style>