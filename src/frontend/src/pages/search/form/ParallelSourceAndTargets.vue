<template>
	<!-- Is this a parallel corpus? -->
	<div v-if="mode === 'simple'">
		<label class="control-label">{{ $t('search.parallel.inSourceVersion') }}</label>
		<div>
			<SelectPicker :options="pSourceOptions" v-model="pSourceValue" data-menu-width="grow" hideEmpty/>
		</div>

		<label class="control-label">{{ $t('search.parallel.andCompareWithTargetVersions') }}</label>
		<div>
			<MultiValuePicker :options="pTargetOptionsWithCurrent" v-model="pTargetValue" />
		</div>
		<AlignBy />
	</div>
	<div v-else>
		<div class="form-group">
			<label class="col-xs-12 col-md-3">{{ $t('search.parallel.inSourceVersion') }}</label>
			<div class="col-xs-12 col-md-9">
				<SelectPicker :options="pSourceOptions" v-model="pSourceValue" data-menu-width="grow" hideEmpty/>
			</div>
		</div>
		<div class="form-group">
			<label class="col-xs-12 col-md-3">{{ $t('search.parallel.andCompareWithTargetVersions') }}</label>
			<div class="col-xs-12 col-md-9">
				<MultiValuePicker :options="pTargetOptionsWithCurrent" v-model="pTargetValue" />
			</div>
		</div>
		<div class="form-group">
			<label class="col-xs-12 col-md-3">{{ $t('search.parallel.alignBy') }}</label>
			<div class="btn-group col-xs-12 col-md-9">
				<AlignBy />
			</div>
		</div>
	</div>
</template>

<script lang="ts">
import ParallelFields from '@/pages/search/form/parallel/ParallelFields';

import SelectPicker from '@/components/SelectPicker.vue';
import MultiValuePicker from '@/components/MultiValuePicker.vue';
import AlignBy from '@/pages/search/form/AlignBy.vue';

export default ParallelFields.extend({
	components: {
		SelectPicker,
		MultiValuePicker,
		AlignBy,
	},
	props: {
		mode: {
			type: String,
			default: 'simple'
		}
	},
});
</script>

<style lang="scss" scoped>

label { font-weight: bold; }

</style>