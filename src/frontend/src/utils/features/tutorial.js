import '@/vendor/pageguide.min.js';

import $ from 'jquery';

/**
 * Enable pageguide-js tutorials on the page and augment its behavior a little.
 */

/**
 * Search an element's parents to find if any of them creates a new stacking context, and if so, get that element's z-index.
 * If no parent creates a new stacking context, get the element's own z-index.
 * If that is set to "auto", returns 1.
 *
 * @param {JQuery} $el the element for which to determine the stacking context root
 */
function getStackingContextZIndex($el) {
	var $stackingContexts = $el.parents().filter(function() {
		var $this = $(this);

		return this !== document && this !== document.documentElement && (
			(($this.css('position') === 'absolute' || $this.css('position') === 'relative') && $this.css('z-index') !== 'auto') ||
			($this.parent().css('display') === 'flex' && $this.parent().css('z-index') !== 'auto') ||
			$this.css('position') === 'fixed' || $this.position === 'sticky' ||
			$this.css('opacity') != 1 ||
			$this.css('transform') !== 'none'
			// uncommon and commonly unsupported settings omitted
		);
	});

	var $ctxElement = $stackingContexts.length ? $stackingContexts.last() : $el;
	var index = $ctxElement.css('z-index');
	return index !== 'auto' ? Number.parseInt(index) : 1;
}

/**
 * We replace the checkTargets function to enhance the z-index handling.
 * Normally tooltips inherit the z-index of the element they're attached to.
 * This is fine, except when that target element is within a different stacking context than the tooltip.
 * In this case we need to know the z-index of the root of that stacking context, instead of the z-index of the direct target element.
 * Or we could end up way too low or high.
 */
function monkeyPatchPageguide() {
	window.tl.pg.PageGuide.prototype.checkTargets = function () { //eslint-disable-line
		var self = this;
		var visibleIndex = 0;
		var newVisibleTargets = [];
		for (var target in self.targetData) {
			var $elements = $(target);
			var $el;
			// assume all invisible
			var newTargetData = {
				targetStyle: {
					display: 'none'
				}
			};
			// find first visible instance of target selector per issue #4798
			for(var i = 0; i < $elements.length; i++){
				if($($elements[i]).is(':visible') ){
					$el = $($elements[i]); // is it weird to '$($x)'?

					newTargetData.targetStyle.display = 'block';
					var offset = $el.offset();
					$.extend(newTargetData.targetStyle, {
						top: offset.top,
						left: offset.left,
						width: $el.outerWidth(),
						height: $el.outerHeight(),
						'z-index': getStackingContextZIndex($el)
					});
					visibleIndex++;
					newTargetData.index = visibleIndex;
					newVisibleTargets.push(target);
					break;
				}
			}
			var diff = {
				target: target
			};
			// compare new styles with existing ones
			for (var prop in newTargetData.targetStyle) {
				if (newTargetData.targetStyle[prop] !== self.targetData[target][prop]) {
					if (diff.targetStyle == null) {
						diff.targetStyle = {};
					}
					diff.targetStyle[prop] = newTargetData.targetStyle[prop];
				}
			}
			// compare index with existing index
			if (newTargetData.index !== self.targetData[target].index) {
				diff.index = newTargetData.index;
			}
			// push diff onto changequeue if changes have been made
			if (diff.targetStyle != null || diff.index != null) {
				self.changeQueue.push(diff);
			}
			$.extend(self.targetData[target], newTargetData);
		}
		self.visibleTargets = newVisibleTargets;
	};
}

$(document).ready(function() {
	monkeyPatchPageguide();

	// use a timeout so bootstrap-select etc has a moment to run
	setTimeout(function() {
		window.tl.pg.init({ // eslint-disable-line
			auto_refresh: true,
			default_zindex: 1, // don't use auto, or overlays will appear beneath elements on the same layer as content is inserted at the top of the page
		});
	}, 1000);
});
