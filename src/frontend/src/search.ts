import 'bootstrap';
import 'bootstrap-select';

import $ from 'jquery';
import URI from 'urijs';

import parseCql, { Attribute } from './utils/cqlparser';
import './utils/features/autocomplete';
import './utils/features/tutorial';

import createQueryBuilder from './modules/cql_querybuilder';
import {BlacklabParameters} from './modules/singlepage-bls';
import './modules/singlepage-interface';

import './pages/search/vuexbridge';
import * as BLTypes from '@/types/blacklabtypes';

import {debugLog} from './utils/debug';

declare var SINGLEPAGE: {INDEX: BLTypes.BLIndexMetadata};

$(document).ready(function() {
	if (window.localStorage) {
		$('input[data-persistent][id != ""]').each(function(i, elem) {
			const $this = $(elem);
			const key = 'input_' + $this.attr('id');
			$this.on('change', function() {
				const curVal: any = $this.is(':checkbox') ? $this.is(':checked') : $this.val();
				window.localStorage.setItem(key, curVal);
			});

			const storedVal = window.localStorage.getItem(key);
			if (storedVal != null) {
				$this.is(':checkbox') ? $this.attr('checked', (storedVal.toLowerCase() === 'true') as any) : $this.val(storedVal);
			}

			// run handler once, init localstorage if required
			// Only do next tick so handlers have a change to register
			setTimeout(function() { $this.trigger('change'); });
		});
	}

	// Init the querybuilder with the supported attributes/properties
	createQueryBuilder($('#querybuilder'), {
		attribute: {
			view: {
				// Pass the available properties of tokens in this corpus (PoS, Lemma, Word, etc..) to the querybuilder
				attributes: $.map(SINGLEPAGE.INDEX.complexFields || SINGLEPAGE.INDEX.annotatedFields, function(complexField/*, complexFieldName*/) {
					return $.map(complexField.properties || complexField.annotations, function(property, propertyId: string) {
						if (property.isInternal) {
							return null;
						} // Don't show internal fields in the queryBuilder; leave this out of the list.

						// Transform the supported values to the querybuilder format
						return {
							attribute: propertyId,
							label: property.displayName || propertyId,
							caseSensitive: (property.sensitivity === 'SENSITIVE_AND_INSENSITIVE')
						};
					});
				}),
			}
		}
	});

	$('#mainForm').on('submit', searchSubmit);

	// Rescale the querybuilder container when it's shown
	$('a.querytype[href="#advanced"]').on('shown.bs.tab hide.bs.tab', function() {
		$('#searchContainer').toggleClass('col-md-6');
	});

	// Enable wide view toggle
	$('#wide-view').on('change', function() {
		$('.container, .container-fluid').toggleClass('container', !$(this).is(':checked')).toggleClass('container-fluid', $(this).is(':checked'));
	});

	// TODO just set the new query in state? the commit probably needs to be async and cancelable/failable...
	// Attempt to parse the query from the cql editor into the querybuilder
	// when the user asks to
	$('#parseQuery').on('click', function() {
		const pattern = $('#querybox').val() as string;
		if (populateQueryBuilder(pattern)) {
			$('#searchTabs a[href="#advanced"]').tab('show');
			$('#parseQueryError').hide();
		} else {
			$('#parseQueryError').show();
			$('#querybox').val(pattern);
		}
	});

	// TODO initiate search
});

/**
 * Encodes search parameters into a page url as understood by fromPageUrl().
 * N.B. we assume we're mounted under /<contextRoot>/<corpus>/search/[hits|docs][/]?query=...
 * The contextRoot can be anything, even multiple segments (due to reverse proxy, different WAR deploy path, etc)
 * But we assume the /search/ part still exists.
 *
 * Removes any empty strings, arrays, null, undefineds prior to conversion, to shorten the resulting query string.
 *
 * @param searchParams the search parameters
 * @returns the query string, beginning with ?, or an empty string when no searchParams with a proper value
 */
function toPageUrl(operation: string, blsParams?: BlacklabParameters|null) {

	const uri = new URI();
	const paths = uri.segmentCoded();
	const basePath = paths.slice(0, paths.lastIndexOf('search')+1);
	// basePath now contains our url path, up to and including /search/

	// If we're not searching, return a bare url pointing to /search/
	if (blsParams == null) {
		return uri.directory(basePath.join('')).search('').toString();
	}

	// remove null, undefined, empty strings and empty arrays from our query params
	const modifiedParams: Partial<BlacklabParameters> = {};
	$.each(blsParams, function(key, value) {
		if (value == null) {
			return true;
		}
		if ((value as any).length === 0) { // TODO
			return true;
		}
		modifiedParams[key] = value;
	});

	// Append the operation, query params, etc, and return.
	return uri.segmentCoded(basePath).segmentCoded(operation).search(modifiedParams).toString();
}

/**
 * Attempt to parse the query pattern and update the state of the query builder
 * to match it as much as possible.
 *
 * @param {string} pattern - cql query
 * @returns True or false indicating success or failure respectively
 */
export function populateQueryBuilder(pattern: string) {
	if (!pattern) {
		return false;
	}

	try {
		const parsedCql = parseCql(pattern);
		const tokens = parsedCql.tokens;
		const within = parsedCql.within;
		if (tokens === null) {
			return false;
		}

		const queryBuilder = $('#querybuilder').data('builder');
		queryBuilder.reset();
		if (tokens.length > 0) {
			// only clear the querybuilder when we're putting something back in
			$.each(queryBuilder.getTokens(), function(i, e) {
				e.element.remove();
			});
		}
		if (within) {
			queryBuilder.set('within', within);
		}

		// TODO: try and repopulate the "simple" tab

		$.each(tokens, function(index, token) {
			const tokenInstance = queryBuilder.createToken();

			// clean the root group of all contents
			$.each(tokenInstance.rootAttributeGroup.getAttributes(), function(i, el) {
				el.element.remove();
			});

			$.each(tokenInstance.rootAttributeGroup.getAttributeGroups(), function(i, el) {
				el.element.remove();
			});

			tokenInstance.set('beginOfSentence', !!token.leadingXmlTag && token.leadingXmlTag.name === 's');
			tokenInstance.set('endOfSentence', !!token.trailingXmlTag && token.trailingXmlTag.name === 's');
			tokenInstance.set('optional', token.optional || false);

			if (token.repeats) {
				tokenInstance.set('minRepeats', token.repeats.min);
				tokenInstance.set('maxRepeats', token.repeats.max);
			}

			function doOp(op: any, parentAttributeGroup: any, level: number) {
				if (op == null) {
					return;
				}

				if (op.type === 'binaryOp') {
					const label = op.operator === '&' ? 'AND' : 'OR'; // TODO get label internally in builder
					if (op.operator !== parentAttributeGroup.operator) {

						if (level === 0) {
							parentAttributeGroup.operator = op.operator;
							parentAttributeGroup.label = label;
						} else if (parentAttributeGroup.operator !== op.operator) {
							parentAttributeGroup = parentAttributeGroup.createAttributeGroup(op.operator, label);
						}
					}

					// inverse order, since new elements are inserted at top..
					doOp(op.right, parentAttributeGroup, level + 1);
					doOp(op.left, parentAttributeGroup, level + 1);
				} else if (op.type === 'attribute') {

					const attributeInstance = parentAttributeGroup.createAttribute();

					// case flag is always at the front, so check for that before checking
					// for starts with/ends with flags
					if (op.value.indexOf('(?-i)') === 0) {
						attributeInstance.set('case', true, op.name);
						op.value = op.value.substr(5);
					} else if (op.value.indexOf('(?c)') === 0) {
						attributeInstance.set('case', true, op.name);
						op.value = op.value.substr(4);
					}

					if (op.operator === '=' && op.value.length >= 2 && op.value.indexOf('|') === -1) {
						if (op.value.indexOf('.*') === 0) {
							op.operator = 'ends with';
							op.value = op.value.substr(2);
						} else if (op.value.indexOf('.*') === op.value.length -2) {
							op.operator = 'starts with';
							op.value = op.value.substr(0, op.value.length-2);
						}
					}

					attributeInstance.set('operator', op.operator);
					attributeInstance.set('type', op.name);

					attributeInstance.set('val', op.value);
				}
			}

			doOp(token.expression, tokenInstance.rootAttributeGroup, 0);
			tokenInstance.element.trigger('cql:modified');
		});
	} catch (e) {
		// couldn't decode query
		debugLog('Cql parser could not decode query pattern', e, pattern);

		return false;
	}

	return true;
}

import { actions, getState } from '@/store';

// --------
// exports
// --------

// Called when form is submitted
export function searchSubmit() {

	actions.search();

	// TODO this seems to fire before the state is updated - move to vuexbridge
	$('html, body').animate({
		scrollTop: $('#searchFormDivHeader').offset()!.top - 75 // navbar
	}, 500);

	// May be used as click handler, so prevent event propagation
	return false;
}

// TODO use pageState instead of blacklab parameters and push that instance of the object
/** Callback from when a search is executed (not neccesarily by the user, could also just be pagination and the like) */
export function onSearchUpdated(operation: string, searchParams: BlacklabParameters) {
	// Only push new url if different
	// Why? Because when the user goes back say, 10 pages, we reinit the page and do a search with the restored parameters
	// this search would push a new history entry, popping the next 10 pages off the stack, which the url is the same because we just entered the page.
	// So don't do that.

	// If we generate very long page urls, tomcat cannot parse our requests (referrer header too long)
	// So omit the query from the page url in these cases
	// TODO this breaks history-based navigation
	let newUrl = toPageUrl(operation, searchParams);
	if (newUrl.length > 4000) {
		newUrl = toPageUrl(operation, $.extend({}, searchParams, { patt: null }));
	}

	const currentUrl = new URI().toString();
	if (newUrl !== currentUrl) {
		history.pushState(getState(), undefined, newUrl);
	}
}

// TODO position properly?

import Vue from 'vue';
import {store} from '@/store';

import ResultComponent from '@/pages/search/Results.vue';

$(document).ready(() => {
	Vue.config.productionTip = false;
	new Vue({
		store,
		render: h => h(ResultComponent),
	}).$mount(document.querySelector('#results')!);

	// new Vue({
	// 	store,
	// 	render: h => h(ResultComponent)
	// }).$mount(document.querySelector('#tabDocs > div')!);
});
