<template>
	<ul id="tlyPageGuide" data-tourtitle="Searching the corpus">
		<li class="tlypageguide_top" data-tourtarget="a[href='#simple']">
			<p>The <code>simple</code></p> search lets you quickly search for words. It supports <code>wildcards</code>.<br>
			<code>Wildcards</code> are special characters that will match any other character. Two kinds of wildcards are supported:<br>
			The <code>*</code> wildcard will match any string, of any length.<br>
			The <code>?</code> wildcard will match any single letter or character.<br>
			As an example: searching for <code>a*b</code> will match <i>all values</i> that start with <code>a</code> and end with <code>b</code>,
			while searching for <code>a?b</code> will match match <i>only three-letter values</i> starting with <code>a</code> and ending with <code>b</code>.<br>
		</li>
		<li class="tlypageguide_top" data-tourtarget="a[href='#extended']">
			<div>
				<p>
					The <code>extended</code> search allows you to quickly find all occurrences of <code>tokens</code> with specific <code>attributes</code> in this corpus.<br>
				</p>
				<p>
					<code>Tokens</code> are the smallest unit within a corpus, usually just a single word.<br>
					<code>Attributes</code> are the different values that together make up a <code>token</code>.<br>
					The most commonly available attributes are <code>Lemma</code>, <code>Part of Speech</code> and <code>Word</code>,
					however this can differ on a corpus by corpus basis.<br>
					All supported attributes for this corpus will be shown here.<br>
				</p>
				<p>
					Enter the value you want to find tokens for in any of the inputs below.<br>
					Press enter or click the search button below to execute the search and view the results.<br>
					As an example: to find all <code>nouns</code> within this corpus (assuming this corpus supports <code>part of speech</code> tags),
					enter <code>NOU</code> (or the equivalent tag for a noun in this corpus) in the <code>part of speech</code> field.<br>
					To find all occurrences of the word "ship", enter <code>ship</code> in the <code>lemma</code> field.<br>
				</p>
				<p>
					Like the <code>simple</code> search, it supports <code>Wildcards</code>.<br>
				</p>
				<p>
					It's also possible to search for series of <code>tokens</code>, such as a <code>verb</code> followed by a <code>noun</code>.<br>
					To do this, enter multiple values in any of the fields, each value separated by a space.<br>
					As an example: to find all instances of an <code>adjective</code> followed by a <code>noun</code> (assuming this corpus contains <code>part of speech</code> tags),<br>
					enter <code>ADJ NOU</code> (or the equivalent names for this corpus) in the <code>part of speech</code> field.<br>
				</p>
				<p>
					Values at the same position in different fields are grouped together as a single <code>token</code>, meaning that all values in the first position of each field are grouped to match a single <code>token</code>,
					likewise for the second values in every field, and so on.<br>
					As an example: searching for <code>part of speech</code> <code>NOU</code> together with <code>lemma</code> <code>a*</code>
					will find all <code>nouns</code> starting with the letter <code>a</code> as you would expect, while searching for <code>pos</code> <code>ADJ NOU</code> together with <code>lemma</code> <code>a* b*</code>
					will find all <code>adjectives</code> starting with the letter <code>a</code>, <i>followed by</i> a <code>noun</code> starting with the letter <code>b</code>.<br>
				</p>
			</div>
		</li>

		<li class="tlypageguide_left" data-tourtarget=".propertyfield .file-input-button">
			<div>
				Click here to upload a list of values to search for.<br>
				Every word in the file will be added to the list of values to search for.<br>
				To remove the wordlist, click the button again, then press <code>cancel</code> when presented with the file selection (only works in chrome),
				or simply delete all text in the field.
			</div>
		</li>

		<li class="tlypageguide_top" data-tourtarget="a[href='#advanced']">
			<div>
				<p>
					This is the <code>querybuilder</code>. With it, you can create complex queries without writing CQL.<br>
				</p>
				<p>
					The querybuilder is structured around configuring the <code>attributes</code> of <code>tokens</code>.<br>
					Create one or more tokens, and fill in which attributes a token must have to be found.<br>
					In addition to the simple search, it's also possible to define specific combinations of attributes, or specify lists of possible attributes, and more.
				</p>
				<p>
					When multiple tokens are used, they are matched in order from left to right.<br>
					Any time a query is created in the querybuilder, it's also copied to the <code>CQL editor</code>, where you can further edit the query by hand.
				</p>
			</div>
		</li>




		<li class="tlypageguide_top" data-tourtarget=".bl-token .panel-heading">
			<div>
				<p>
					This is a <code>token</code>, the basic building block of a query.<br>
				</p>
				<p>
					A token in the querybuilder is made up two parts:<br>
					The set of <code>attributes</code> a token in the corpus must have to be matched by the query.<br>
					Create attributes by clicking the + button within this token. Then enter a value that the attribute must have for the token to be found.<br>
					Contextual <code>properties</code>, such as whether the <code>token</code> occurs at the start, or the end of a sentence.
				</p>
				<p>
					The CQL query generated to match this token in the corpus is also displayed here, to help understand what is happening internally.<br>
				</p>
				<p>
					Rearrange a token by clicking and dragging the little arrow handle in the top-left corner.<br>
					Delete a token by clicking the x in the top-right corner.<br>
					Create new tokens by clicking the + button over on the right.<br>
				</p>
			</div>
		</li>

		<li class="tlypageguide_top" data-tourtarget=".bl-token-create">
			<div>
				Create additional tokens by clicking this button.
			</div>
		</li>

		<li class="tlypageguide_right" data-tourtarget=".bl-token-attribute">
			<div>
				<p>
					This is an <code>attribute</code> of this token.<br>
				</p>
				<p>
					Attributes are much like in the <code>simple</code> search. Select which attribute
					a token should have, and enter the value that the attribute must have for the token to be matched.<br>
					In addition to this simple behavior the querybuilder also allows several more advanced configurations.<br>
					Attributes in the querybuilder are interpreted as <code>regular expressions</code>.
				</p>
				<p>
					Using the + buttons, new attributes can be added. Two options exist: <code>AND</code> and <code>OR</code>.<br>
					The <code>AND</code> option creates a new attribute that <i>also</i> must exist on a token for that token to be matched.<br>
					As an example: the attribute <code>part of speech</code> with value <code>NOU</code> is already defined, so all tokens that are nouns will be matched.<br>
					Creating a new attribute using <code>AND</code> will change that query so that now a token must be a noun, <i>in addition</i> to being/having whatever new attribute is created.<br>
					The <code>OR</code> largely performs the same role, with the change that a token will now be matched whenever it has the original attribute <i>or</i> the new attribute.<br>
					As an example: you have an attribute <code>lemma = "bee"</code>, and you select <code>AND</code>.<br>
					Now you have <code>lemma = "bee"</code> AND <code>some other attribute</code>, and both of these must be true for a token to be found.<br>
					If you had selected <code>OR</code> it would find all tokens with either <code>lemma = "bee"</code> or that have your new attribute<br>
				</p>
				<p>
					It's also possible to upload a list of values, to do so, click the upload button that appears when you hover the mouse over the text input for this attribute and select a text file.
					Tokens will then be matched for any of the values from the file.<br>
					Uploaded files must be be plain text files (.txt), with each value on its own line.<br>
					After uploading a file, the text can be edited by clicking the yellow button that has appeared in place of the text field. Editing the text is temporary and will not modify your original file.<br>
					To remove an uploaded file and go back to typing a value, click the upload button a second time, then press cancel instead of selecting a file.
				</p>
			</div>
		</li>


		<li class="tlypageguide_top" data-tourtarget="a[href='#query']">
			<div>
				<p>
					The <code>CQL editor</code> allows you to type your own CQL query, or edit a query further after creating it in the <code>querybuilder</code>.
				</p>
				<p>
					Queries generated by the <code>querybuilder</code> will be pasted here automatically. Note that this will overwrite any queries you type here yourself!<br>
					In some cases, when the query is relatively simple, it can be also be imported into the querybuilder using the <code>copy to query builder</code> button below.
					A message will be displayed next to the button if the query couldn't be parsed.
				</p>
				<p>
					For more information on how to write <code>CQL</code>, <a style="text-decoration:underline;color:#337ab7;" target="_blank" href="https://github.com/INL/BlackLab/blob/d20eb71b25137facf10f7d2681242de34ab1fa54/core/src/site/markdown/corpus-query-language.md">click here</a>.
				</p>
			</div>
		</li>

		<li class="tlypageguide_top" data-tourtarget="#importQuery">
			<div>
				<p>
					Import previously saved queries here.
				</p>
				<p>
					To <code>export</code> a query: first run a search, then open the history, and select <code>save as file</code> in the dropdown on the right.
				</p>
			</div>
		</li>

		<li class="tlypageguide_top" data-tourtarget="#filterContainer">
			<div>
				<p>
					Listed here are the <code>metadata</code> fields that exist on documents within this corpus.<br>
					Using these fields a query can be limited to a subset of documents with specific metadata values.<br>
					It's also possible to view all documents by leaving all <code>attributes</code> in the <code>simple</code> search empty.
				</p>
				<p>
					As an example: to search within only documents from the year <code>2003</code> (assuming documents contain metadata for the year of writing),<br>
					type <code>2003</code> in the <code>year</code> field (or the equivalent name of the year data in this corpus).<br>
				</p>
				<p>
					Some values like dates and numbers support entering a <code>range</code>.<br>
					Ranges are <code>inclusive</code>, meaning that for a range of <code>10 to 20</code>, documents for which the value is exactly 10 or 20 will also be included.
				</p>
				<p>
					Some of the most common values will for each field be autocompleted as you are entering a value. Clicking on an autocompleted value will paste that value in the field.<br>
					For fields where the total number of different values is relatively small, a dropdown will be shown instead, allowing you to pick the exact set of documents to search.<br>
				</p>
				<p>
					To search in documents within a set of different values, enter multiple values, separated by spaces. If one of the values already contains spaces of itself, it must be surrounded by double quotes (<code>"</code>).<br>
					As an example: to match the value <code>my metadata value</code>, enter <code>"my metadata value"</code> in the field, including the quotes.<br>
					Entering <code>three different values</code> without quotes will instead search in any document with a value of <code>three</code>, <code>different</code> or <code>values</code> for that metadata field.
				</p>
			</div>
		</li>

		<li class="tlypageguide_top" data-tourtarget="#resultTabs">
			<div>
				Results can be viewed in two ways: as individual <code>hits</code> (groups of one or more <code>tokens</code> that matched the query),
				or as the <code>documents</code> in which those hits exist.<br>
				Hits are only available when the query matches at least one attribute.
			</div>
		</li>

		<li class="tlypageguide_top" data-tourtarget=".results-table th .dropdown">
			<div>
				Click on any of the column headings to sort the <code>hits</code> on values within the column, clicking again inverts the sorting.
			</div>
		</li>

		<li class="tlypageguide_top" data-tourtarget=".doctitle a">
			<div>
				<p>
					<code>Hit</code> rows are always preceded by a row containing the <code>document</code> in which those hits occurred.<br>
					Hit rows can be toggled on or off using the <code>Show/hide titles</code> button.<br>
				</p>
				<p>
					Click the title of this document to open the document in a new window. Hits from the current query will be highlighted in the opened document.<br>
					This functionality is only available when the corpus has not disabled the viewing of documents.<br>
				</p>
			</div>
		</li>

		<li class="tlypageguide_top" data-tourtarget=".hits-table tr.concordance">
			<div>
				Click a hit to show a part of the document surrounding the hit. Click again to close.
			</div>
		</li>

		<li class="tlypageguide_top" data-tourtarget=".groupselect">
			<div>
				<p>
					Results can be grouped by properties of the <code>tokens</code> or <code>documents</code> in which those hits occur.<br>
					<code>left context</code>, <code>right context</code> and <code>hit</code> will group the tokens based on the <code>token's</code> attributes.<br>
					The remaining options group by the <code>metadata</code> of the <code>documents</code>.
				</p>
				<!-- <p>
					Grouping by multiple properties simultaneously is possible by selecting more than one option.
				</p> -->
			</div>
		</li>

		<li class="tlypageguide_top" data-tourtarget=".group-size-indicator">
			<div>
				Click a <code>group</code> to show or hide the <code>hits</code> within that group.
			</div>
		</li>

		<li class="tlypageguide_top" data-tourtarget=".open-concordances">
			<div>
				Click here to go back to the normal <code>hits</code> view to see more detailed information for the hits in this group.<br>
				A small indicator will appear to let you know that you're looking at hits from a specific group only.
			</div>
		</li>

		<li class="tlypageguide_right" data-tourtarget="tr.document">
			<div>
				Information about a <code>document</code>.<br>
				Click the document's title or the <code>view document info</code> button to open this document in a new window.<br>
				This functionality is only available when the corpus has not disabled the viewing of documents.<br>
			</div>
		</li>
	</ul>
</template>

<script>
import Vue from 'vue';
import $ from 'jquery';

import '@/vendor/pageguide.min.js';

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

let inited = false;

export default Vue.extend({
	mounted() {
		if (!inited) {
			monkeyPatchPageguide();

			window.tl.pg.init({ // eslint-disable-line
				auto_refresh: true,
				default_zindex: 1, // don't use auto, or overlays will appear beneath elements on the same layer as content is inserted at the top of the page
			});

			inited = true;
		}

	}
})

</script>