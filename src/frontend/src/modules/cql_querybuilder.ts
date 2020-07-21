import 'jquery-extendext';
import 'jquery-ui';
import 'jquery-ui/ui/widgets/sortable';

import $ from 'jquery';
import * as Mustache from 'mustache';

import parseCql, {BinaryOp as CQLBinaryOp, Attribute as CQLAttribute, DEFAULT_ATTRIBUTE} from '@/utils/cqlparser';
import {debugLog} from '@/utils/debug';

import {RecursivePartial} from '@/types/helpers';

import '@/modules/cql_querybuilder.scss';

/**
 * The querybuilder is a visual editor for CQL queries (see http://inl.github.io/BlackLab/corpus-query-language.html#supported-features for an introduction to CQL)
 * The querybuilder is a hierarchy of nested objects, where every object is represented by its own isolated container in the DOM.
 *
 * At the top is the QueryBuilder itself, it contains/manages Tokens
 * Every token representes a '[]' block within CQL, and contains one or more (potentially nested) AttributeGroups.
 * An AttributeGroup is a nesting structure containing a mix of other AttributeGroups and Attributes.
 *  It essentially represents a pair of brackets '()' in which Attributes are combined using OR/AND (though this is configurable)
 *  It also contains a few buttons for adding/removing Attributes within the group.
 * The Attribute is the real meat, it configures the requirements a single Token needs to meet to be matched by the query.
 *  It contains a selector (usually for Part of Speech/Lemma/Word, though this is configurable), a comparator (like equals/not equals/starts with/ends with, also configurable)
 *  and a value to compare it to.
 *
 * Mustache.js is used to generate the DOM elements for the components, the templates are based on bootstrap.
 * Every component attaches a reference to itself to the DOM element through $.data.
 *
 * Every object defines the functions _createElement() and _prepareElement(), these are used to generate the dom structure and attach event handlers respectively.
 * Also present is a getCql() function that recurses into all child elements, calls getCql on them, and
 * combines their parts of the query to gradually build up the complete query.
 *
 *
 * When genering a CQL query, the state of the builder is read from the DOM, so simply removing an element from the DOM removes it from the query.
 */

/**
 * These are the mustache.js templates.
 * They are grouped at the top by the component type: token, attributeGroup, attribute, operatorLabel (the OR/AND labels in between attributes)
 * When rendering the component, 3 parts are required, the "template", "partials", and the "view", the template is the entry point for rendering.
 * It can render sub elements defined in the "partials" object using {{>key_in_partial_object}}.
 * Finally dynamic values can be inserted from the "view" object using {{key_in_view_object}}.
 * Some partials and view data is used in several different components, rather than copying it, these shared
 * partials and view data are defined in the "shared" key in the templates and view objects here,
 * and are merged into the element-specific partials and views in the _createElement function for the element in question.
 *
 * Since the view is dynamic data (labels, supported operators, supported word attributes etc.),
 * it can be overridden externally.
 * To support this, a custom settings object can be passed when initially creating the querybuilder instance.
 * This object must follow the structure of "DEFAULTS", the custom settings object will override properties with the same name in DEFAULTS, including the mustache view data object.
 */
const templates = {

	queryBuilder: {
		template: `
			<div class="bl-token-container">
				{{>createTokenButton}}
			</div>
			{{>withinSelect}}
			{{>modalEditor}}
		`,

		partials: {
			createTokenButton: `
				<button type="button" class="btn btn-primary bl-token-create bl-prevent-sort" title="Insert another token"><span class="glyphicon glyphicon-plus"></span></button>
			`,

			modalEditor: `
				<div class="bl-modal-editor modal fade" tabindex="-1" role="dialog">
					<div class="modal-dialog" role="document">
						<div class="modal-content">
							<div class="modal-header">
								<button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>
								<h4 class="modal-title">Edit</h4>
							</div>
							<div class="modal-body">
								<textarea class="form-control" rows="10" style="width:100%;overflow:auto;resize:none;white-space:pre;"></textarea>
							</div>
							<div class="modal-footer">
								<button type="button" class="btn btn-primary pull-left" data-dismiss="modal" data-discard-value>Clear</button>
								<button type="button" class="btn btn-default" data-dismiss="modal">Cancel</button>
								<button type="button" class="btn btn-primary" data-dismiss="modal" data-save-edits>Save changes</button>
							</div>
						</div>
					</div>
				</div>
			`,

			withinSelect: `
				{{#withinSelectOptions.0}}
				<label>Within:</label>
				<div class="btn-group bl-within-select clearfix" data-toggle="buttons" id="within_select" style="display:block;">
				{{/withinSelectOptions.0}}
					{{#withinSelectOptions}}
						<label class="btn btn-default">
							<input type="radio" autocomplete="off" name="within" value="{{value}}">{{label}}
						</label>
					{{/withinSelectOptions}}
				{{#withinSelectOptions.0}}
				</div>
				{{/withinSelectOptions.0}}
			`,
		},
	},

	token: {
		template: `
			<div class="panel panel-primary bl-token" id="{{currentId}}">
				{{>head_root}}
				{{>body_root}}
			</div>
		`,

		partials: {
			head_root: `
				<div class="panel-heading clearfix">
					{{>head_handle}}
					{{>head_deleteButton}}
					{{>head_cqlPreview}}
				</div>
			`,
			head_handle: `
				<span class="glyphicon glyphicon-resize-horizontal bl-sort-handle" style="margin-right:5px;" title="Drag here to move this token"></span>
			`,
			head_deleteButton: `
				<button type="button" class="close" area-label="delete" title="remove token"><span aria-hidden="true">&times;</span></button>
			`,

			head_cqlPreview: `
				<span id="{{currentId}}_cql_preview">Generated cql will appear here.</span>
			`,

			body_root: `
				<div class="panel-body" id="{{currentId}}_panel_body">
					{{>body_tab_header}}
					{{>body_tab_container}}
				</div>
			`,

			body_tab_header: `
				<ul class="nav nav-tabs">
					<li class="active"><a data-toggle="tab" href="#{{currentId}}_tab_attributes">search</a></li>
					<li><a data-toggle="tab" href="#{{currentId}}_tab_properties">options</a></li>
				</ul>
			`,
			body_tab_container: `
				<div class="tab-content">
					{{>body_tab_attributes}}
					{{>body_tab_properties}}
				</div>
			`,

			body_tab_attributes: `
				<div id="{{currentId}}_tab_attributes" class="tab-pane active" style="padding: 25px 15px;">
				</div>
			`,

			body_tab_properties: `
				<div id="{{currentId}}_tab_properties" class="tab-pane" style="padding: 10px 15px 25px 15px;">
					<div class="checkbox">
						<label title="Token is optional"><input type="checkbox" id="{{currentId}}_property_optional">Optional</label>
					</div>
					<div class="checkbox">
						<label title="Token must occur at beginning of sentence"><input type="checkbox" id="{{currentId}}_property_sentence_start">Begin of sentence</label>
					</div>
					<div class="checkbox">
						<label title="Token must occur at end of sentence"><input type="checkbox" id="{{currentId}}_property_sentence_end">End of sentence</label>
					</div>
					<div class="input-group" style="width:318px;">
						<span class="input-group-addon">repeats</span>
						<input type="text" class="form-control" value="1" id="{{currentId}}_property_repeats_min">
						<span class="input-group-addon" style="border-left-width:0px; border-right-width:0px;">to</span>
						<input type="text" class="form-control" value="1" id="{{currentId}}_property_repeats_max">
						<span class="input-group-addon">times</span>
					</div>
				</div>
			`,
		}
	},

	attributeGroup: {
		template: `
			<div class="well bl-token-attribute-group" id="{{currentId}}">
				{{>create_attribute_dropdown}}
			</div>
		`,
		partials: {}
	},

	attribute: {
		template: `
			<div class="bl-token-attribute" id="{{currentId}}">
				<div class="bl-token-attribute-main">
					{{>delete_attribute_button}}
					<select data-attribute-role="type" class="selectpicker" data-width="75px" data-container="body" data-style="btn btn-sm btn-default bl-no-border-radius-right">
						{{#attributes}}
						{{#groupname}}
							<optgroup label="{{groupname}}">
							{{#options}}
								<option value="{{attribute}}">{{label}}</option>
							{{/options}}
							</optgroup>
						{{/groupname}}
						{{^groupname}}
							<option value="{{attribute}}">{{label}}</option>
						{{/groupname}}
						{{/attributes}}
					</select>
					<select data-attribute-role="operator" class="selectpicker" data-width="50px"; data-container="body" data-style="btn btn-sm btn-primary bl-selectpicker-hide-caret bl-no-border-radius">
						{{#comparators}}
						<optgroup>
							{{#.}}
							<option value="{{value}}">{{label}}</option>
							{{/.}}
						</optgroup>
						{{/comparators}}
					</select>
					{{>main_input}}
					{{>create_attribute_dropdown}}
				</div>
				{{#attributes}}{{#caseSensitive}}
				<div data-attribute-type="{{attribute}}" style="display:none;">
					<div class="checkbox">
						<label>
							<input data-attribute-role="case" type="checkbox">
							Case&nbsp;and&nbsp;diacritics&nbsp;sensitive
						</label>
					</div>
				</div>
				{{/caseSensitive}}{{/attributes}}
			</div>
		`,

		partials: {
			delete_attribute_button: `
				<span data-attribute-role="delete" class="glyphicon glyphicon-remove text-primary" style="flex-grow:0;cursor:pointer;" title="Remove this attribute"></span>
			`,

			main_input: `
				<div class="bl-has-file-hidden bl-token-attribute-main-input-container">
					{{#attributes}}
					{{#groupname}}{{#options}}{{>main_input_value}}{{/options}}{{/groupname}}
					{{^groupname}}{{>main_input_value}}{{/groupname}}
					{{/attributes}}
				</div>
				{{>main_input_file_controls}}
			`,

			main_input_value: `
				<div class="bl-token-attribute-main-input" data-attribute-type="{{attribute}}">
					{{#values.0}}
						{{>main_input_select}}
					{{/values.0}}
					{{^values.0}}
						{{>main_input_original}}
					{{/values.0}}
				</div>
			`,

			main_input_file_controls: `
				<label class="bl-has-file-hidden btn btn-sm btn-default bl-no-border-radius bl-input-upload-button" title="Upload a list of values">
					<input data-attribute-role="file" type="file" accept="text/*" class="bl-input-upload" title="Upload a list of values">
					<span class="glyphicon glyphicon-open"></span>
				</label>

				<button data-attribute-role="edit"  type="button" class="bl-has-file-shown btn btn-sm btn-default bl-no-border-radius" title="Edit your uploaded values" style="background-color:#ffa;">loading...</button>
				<button data-attribute-role="clear" type="button" class="bl-has-file-shown btn btn-sm btn-default bl-no-border-radius" title="Clear uploaded values" style="border-left:none;"><span class="fa fa-times"></span></button>
			`,

			main_input_original: `
				<input
					data-attribute-role="value"
					type="text"
					class="form-control input-sm bl-no-border-radius bl-has-file-hidden"
					style="min-width:110px; width:0;"
					{{#textDirection}}dir="{{textDirection}}"{{/textDirection}}
				>
			`,

			// TODO rtl not supported for Bootstrap-Select (https://github.com/snapappointments/bootstrap-select/issues/862)
			main_input_select: `
				<select data-attribute-role="value" multiple class="selectpicker" data-style="btn btn-default btn-sm bl-no-border-radius" data-container="body" data-live-search="true">
					{{#values}}
					<option value="{{value}}">{{label}}</option>
					{{/values}}
				</select>
			`,
		}
	},

	operatorLabel: {
		template: `
			<div class="bl-token-attribute-group-label">
				{{label}}
			</div>
		`,

		partials: {}
	},

	shared: {
		partials: {
			create_attribute_dropdown: `
				<div class="dropup bl-create-attribute-dropdown">
					<button type="button" class="btn btn-sm btn-default dropdown-toggle" data-toggle="dropdown" title="Add another attribute"><span class="glyphicon glyphicon-plus"></span>&#8203;</button>
					<ul class="dropdown-menu">
						{{#operators}}
						<li><a href="#" onclick="$(this).trigger('cql:attribute:create', { operator: '{{operator}}', operatorLabel: '{{label}}' }); return false;">
							<span class="glyphicon glyphicon-plus-sign text-success"></span> {{label}}</a></li>
						{{/operators}}
					</ul>
				</div>
			`,
		}
	}
};

export type AttributeDef = {
	attribute: string;
	label: string;
	caseSensitive: boolean;
	textDirection: undefined|'ltr'|'rtl';
	values: undefined|Array<{
		value: string;
		label?: string;
	}>;
};

const DEFAULTS = {

	queryBuilder: {
		view: {
			// The first option is automatically selected on init
			// Empty value will omit the "within" tag from the query, essentially serving as a default option
			// Syntax to transform the value into <value/> is inserted when the query is generated
			withinSelectOptions: [
				{value:'',  label:'document'},
				{value:'p', label:'paragraph'},
				{value:'s', label:'sentence'},
			]
		}
	},

	attribute: {
		view: {
			comparators: [
				[
					{value:'=', 	label:'='},
					{value:'!=', 	label:'≠'}
				],
				[
					{value:'starts with', 	label: 'starts with'},
					{value:'ends with', 	label: 'ends with'}
				]
			],
			attributes: [
				{
					attribute: 'word',
					label: 'word',
					caseSensitive: true,
					textDirection: undefined,
					values: undefined
				},
				{
					attribute: 'lemma',
					label: 'lemma',
					caseSensitive: true,
					textDirection: undefined,
					values: undefined
				},
				{
					attribute: 'pos',
					label: 'Part of speech',
					caseSensitive: false,
					textDirection: undefined,
					values: undefined
				}
			] as Array<AttributeDef | { groupname: string; options: AttributeDef[]}>,

			defaultAttribute: 'word'
		},

		getCql (attribute: string, comparator: string, caseSensitive: boolean, values: string[]) {
			switch (comparator) {
			case 'starts with':
				comparator = '=';
				values = $.map(values, function(elem/*, index*/) {
					return elem + '.*';
				});
				break;
			case 'ends with':
				comparator = '=';
				values = $.map(values, function(elem/*, index*/) {
					return '.*' + elem;
				});
				break;
			default:
				break;
			}

			return attribute + ' ' + comparator + ' "' + (caseSensitive ? '(?-i)' : '') + values.join('|') + '"';
		}
	},

	token: {
		view: {},
		rootOperator: { operator: '&', label: 'AND' }
	},

	attributeGroup: {
		view: {}
	},

	shared: {
		view: {
			operators: [
				{operator: '&', label: 'AND'},
				{operator: '|', label: 'OR'}
			]
		},
	}
};

type QueryBuilderOptions = RecursivePartial<typeof DEFAULTS>;
// so not everything is optional and extracting types from nested properties works
export type QueryBuilderOptionsDef = typeof DEFAULTS;

// -------------------
// Class Querybuilder
// -------------------

export class QueryBuilder {
	public settings: typeof DEFAULTS;
	public element: JQuery<HTMLElement>; // TODO private and expose update function
	private createTokenButton: JQuery<HTMLElement>;
	public modalEditor: JQuery<HTMLElement>;
	private withinSelect: JQuery<HTMLElement>;

	constructor($rootElement: JQuery<HTMLElement>, options: QueryBuilderOptions) {
		// Use extendext so arrays in the defaults are replaced instead of merged with those in options
		this.settings = $.extendext(true, 'replace', {}, DEFAULTS, options);
		this._prepareElement($rootElement);

		this.element = $rootElement;
		this.createTokenButton = $rootElement.find('.bl-token-create');
		this.modalEditor = this.element.find('.bl-modal-editor');
		this.withinSelect = this.element.find('#within_select');

		this.createTokenButton.click();
	}

	private _prepareElement($element: JQuery<HTMLElement>) {
		$element
			.html(Mustache.render(templates.queryBuilder.template, this.settings.queryBuilder.view, templates.queryBuilder.partials))
			.data('builder', this)
			.addClass('bl-querybuilder-root');

		// Enable sorting tokens within the container
		($element.find('.bl-token-container') as any).sortable({
			items: '>*:not(.bl-prevent-sort)',
			handle: '.bl-sort-handle',
			placeholder: 'bl-sort-placeholder-token',
			forcePlaceholderSize: true,

			cursor: 'move',
			tolerance: 'pointer',

			start (e: JQuery.Event, ui: any) {
				ui.placeholder.height(ui.helper.outerHeight());
				ui.placeholder.width(ui.helper.outerWidth());
			},
			update () {
				$element.trigger('cql:modified');
			}
		});

		$element.find('.bl-token-create').on('click', this.createToken.bind(this));
		$element.find('#within_select')
			.on('change', function() { $element.trigger('cql:modified'); })
			.find('input').first().attr('checked', 'checked')
			.parent().addClass('active');

		return $element;
	}

	// create a new token and insert it in the root container
	public createToken() {
		const token = new Token(this);

		token.element.insertBefore(this.createTokenButton);
		this.element.trigger('cql:modified');

		return token;
	}

	public getTokens() {
		return this.element.children('.bl-token-container').children('.bl-token').map(function(i, elem) {
			return $(elem).data('token');
		}).get();
	}

	public getCql() {
		const cqlParts: string[] = [];

		this.element.find('.bl-token').each(function(index, element) {
			cqlParts.push($(element).data('token').getCql());
		});

		const within = this.withinSelect.find('input:checked').first().val() as string;
		if (within) { // ignore empty and null
			cqlParts.push('within', '<'+ within+'/>');
		}

		return cqlParts.join(' ') || null;
	}

	// When setting 'within', val should only be the name, without surrounding </>
	public set(controlName: 'within', val: string) {
		switch (controlName) {
		case 'within': {
			// Parent because bootstrap is expects us to call .button on the wrapper label...
			this.withinSelect.find('input[value="'+val+'"]').parent().button('toggle');
			break;
		}
		default:
			break;
		}
	}

	public reset() {
		this.element.find('.bl-token').remove();
		this.createToken();
		this.withinSelect.find('input').first().parent().button('toggle');
	}

	public parse(cql: string|null): boolean {
		return populateQueryBuilder(this, cql);
	}
}

// ----------
// Class Token
// ----------

export class Token {
	public readonly id = generateId('token');
	private readonly idSelector = '#' + this.id;
	public readonly element =this._createElement();
	private readonly $controls = {
		optional: this.element.find(this.idSelector + '_property_optional'),
		minRepeats: this.element.find(this.idSelector + '_property_repeats_min'),
		maxRepeats: this.element.find(this.idSelector + '_property_repeats_max'),
		beginOfSentence: this.element.find(this.idSelector + '_property_sentence_start'),
		endOfSentence: this.element.find(this.idSelector + '_property_sentence_end')
	};
	public readonly rootAttributeGroup = this._createRootAttributeGroup();

	constructor(private readonly builder: QueryBuilder) {
		this.rootAttributeGroup.createAttribute();
	}

	private _createElement() {
		const view = $.extend({}, this.builder.settings.token.view, { currentId: this.id });
		const $element = $(Mustache.render(templates.token.template, view, templates.token.partials));

		$element.data('token', this);
		$element.find('input, textarea').on('change', function() {
			$element.trigger('cql:modified');
		});

		const self = this;
		$element.find('.close').on('click', function() {
			$element.remove();
			self.builder.element.trigger('cql:modified');
		});

		$element.on('cql:modified', this._updateCql.bind(this));
		return $element;
	}

	private _createRootAttributeGroup() {
		const group = new AttributeGroup(this.builder, this.builder.settings.token.rootOperator.operator, this.builder.settings.token.rootOperator.label);
		group.element.removeClass('well');
		group.element.appendTo(this.element.find(this.idSelector + '_tab_attributes'));
		group.isRoot = true;

		return group;
	}

	private _updateCql() {
		const $cqlPreviewElement = this.element.find(this.idSelector + '_cql_preview');
		const $tokenPanelHeading = this.element.find('.panel-heading');
		const $tokenPanelBody = this.element.find('.panel-body');

		let cqlString = this.getCql();
		if (cqlString.length > 250) {
			cqlString = cqlString.slice(0, 245) + '…';
		}
		$cqlPreviewElement.text(cqlString);

		// Set an explicit max-width to our header (containing the CQL preview string)
		// Why? because otherwise text won't wrap and the token could become very wide for long queries.
		// We want the token body to control the width of the entire token, and the token head to expand and contract together with the token body.
		// There is no way to do this cleanly in pure css currently.
		// We also need to take care to set a default when this code runs while the element isn't visible, or isn't attached to the DOM.
		// When this happens, jquery doesn't return a sensible outerWidth value for our body.
		// we can't know if the token body is wider than this default (currently 348px), so it will be wrong if the token body is wider than a usual empty token, but this is rare.
		const width = $tokenPanelBody.outerWidth() || 0;
		$tokenPanelHeading.css({
			'width': '100%',
			'max-width': Math.max(width, 348) + 'px'
		});
	}

	public set(controlName: keyof Token['$controls'], val: string|boolean|number|null|undefined) {
		if (this.$controls[controlName]) {
			setValue(this.$controls[controlName], val);
		}
	}

	public getCql() {
		const optional = this.$controls.optional.prop('checked');
		let minRepeats = parseInt(this.$controls.minRepeats.val() as string, 10);
		let maxRepeats = parseInt(this.$controls.maxRepeats.val() as string, 10);
		const beginOfSentence = this.$controls.beginOfSentence.prop('checked');
		const endOfSentence = this.$controls.endOfSentence.prop('checked');

		const outputParts = [] as string[];

		if (beginOfSentence) {
			outputParts.push('<s> ');
		}

		outputParts.push('[ ');
		outputParts.push(this.rootAttributeGroup.getCql());
		outputParts.push(' ]');

		if (!isNaN(minRepeats) || !isNaN(maxRepeats)) { // Only output when at least one of them is entered
			minRepeats = minRepeats || 0;			// Set some default values in case of omitted field
			maxRepeats = maxRepeats || Infinity;

			if (minRepeats < maxRepeats) {
				if (maxRepeats !== Infinity) { // infinite is empty field instead of max value
					outputParts.push('{'+minRepeats+','+maxRepeats+'}');
				} else {
					outputParts.push('{'+minRepeats+', }');
				}
			} else if (minRepeats === maxRepeats && minRepeats !== 1) { // 1 is the default so if min == max == 1 then we don't need to do anything
				outputParts.push('{'+minRepeats+'}');
			}
		}

		if (optional) {
			outputParts.push('?');
		}

		if (endOfSentence) {
			outputParts.push(' </s>');
		}

		return outputParts.join('');
	}
}

// ---------------------
// Class AttributeGroup
// ---------------------

export class AttributeGroup {
	private readonly builder: QueryBuilder;
	private readonly id = generateId('attribute_group');
	private readonly idSelector = '#' + this.id;

	public operator: string; // todo type according to passed in settings
	public operatorLabel: string;
	public element: JQuery<HTMLElement>;
	public isRoot: boolean = false; // set from parent

	constructor(parentBuilder: QueryBuilder, operator: string, operatorLabel: string) {
		this.builder = parentBuilder;
		const id = generateId('attribute_group');
		this.operator = operator;
		this.operatorLabel = operatorLabel;
		this.element =  this._createElement(id);
	}

	private _createElement(id: string) {
		const view = $.extend({}, this.builder.settings.shared.view, this.builder.settings.attributeGroup.view, { currentId: id });
		const partials = $.extend({}, templates.shared.partials, templates.attributeGroup.partials);

		const $element = $(Mustache.render(templates.attributeGroup.template, view, partials));
		this._prepareElement($element);
		return $element;
	}

	private _prepareElement($element: JQuery<HTMLElement>) {
		$element.data('attributeGroup', this);
		$element.on('cql:modified', this._updateLabels.bind(this));
		$element.on('cql:attribute:create', this._createAttribute.bind(this));
	}

	private _createAttribute(attributeCreateEvent: JQuery.TriggeredEvent, data: {operator: string, operatorLabel: string}) {
		// The attribute for which the create button was clicked (if null, the button was our own button)
		const originAttribute: Attribute|undefined = $(attributeCreateEvent.target).parents('.bl-token-attribute').data('attribute');

		const newAttribute = new Attribute(this.builder);
		let newGroup: AttributeGroup|undefined;

		/*
		* If the new attribute was created at the bottom of the group, wrap all existing attributes inside a new group
		* then swap this group's operator to the new operator, and append the new attribute
		*/

		// we can just swap the operator if this contains only 1 attribute
		if (this.element.children('.bl-token-attribute, .bl-token-attribute-group').length <= 1) {
			this.operator = data.operator;
			this.operatorLabel = data.operatorLabel;
		}

		// Construct a new group and put the new operator in there together with the one that triggered the creation (if any)
		if (data.operator !== this.operator) {
			newGroup = new AttributeGroup(this.builder, data.operator, data.operatorLabel);
			if (originAttribute) {
				// Create a new group with the original attribute, and the new attribute
				// at the position of the original attribute
				this.addAttributeOrGroup(newGroup, originAttribute);
				newGroup.addAttributeOrGroup(newAttribute);
				newGroup.addAttributeOrGroup(originAttribute);
			} else {
				// Create a new group, put in everything inside this group
				// Then swap our operator and add the new attribute
				$(this.element.children('.bl-token-attribute, .bl-token-attribute-group').get().reverse()).each(function(index, element) {
					const instance: Attribute|AttributeGroup = $(element).data('attribute') || $(element).data('attributeGroup');
					newGroup!.addAttributeOrGroup(instance);
				});

				this.addAttributeOrGroup(newGroup);
				this.addAttributeOrGroup(newAttribute, newGroup);
				newGroup.operator = this.operator;
				newGroup.operatorLabel = this.operatorLabel;
				this.operator = data.operator;
				this.operatorLabel = data.operatorLabel;
			}
		} else {
			if (originAttribute) { // Insert below existing attribute
				this.addAttributeOrGroup(newAttribute, originAttribute);
			} else { // Append at end of this group
				const $lastChild = this.element.children('.bl-token-attribute, .bl-token-attribute-group').last();
				const lastChildData = $lastChild.data('attributeGroup') || $lastChild.data('attribute');

				this.addAttributeOrGroup(newAttribute, lastChildData);
			}
		}

		this._updateLabels();
		if (newGroup) {
			newGroup._updateLabels();
		}

		this.element.trigger('cql:modified');
		return false;
	}

	public _removeIfEmpty() {
		const $children = this.element.children('.bl-token-attribute, .bl-token-attribute-group');
		const parentGroup: AttributeGroup = this.element.parent().data('attributeGroup');
		const self = this;

		if (this.isRoot) {
			// Never hide root group, should be able to contain 0 members to indicate "[]", or any word
			return;
		}

		if ($children.length <= 1) {
			// Move children before removing this, so we can give them the correct index based on this
			$children.each(function(index, element) {
				const instance: Attribute|AttributeGroup = $(element).data('attributeGroup') || $(element).data('attribute');
				parentGroup.addAttributeOrGroup(instance, self);
			});

			this.element.remove();
			parentGroup._updateLabels();
			parentGroup.element.trigger('cql:modified');
		}
	}

	private _updateLabels() {
		this.element.children('.bl-token-attribute-group-label').remove();

		const self = this;
		this.element.children('.bl-token-attribute, .bl-token-attribute-group').each(function(index, element) {
			const $newLabel = $(Mustache.render(templates.operatorLabel.template, {label: self.operatorLabel}, templates.operatorLabel.partials));
			$newLabel.insertAfter(element);
		});
		this.element.children('.bl-token-attribute-group-label').last().remove();
	}

	public createAttribute() {
		const attribute = new Attribute(this.builder);
		this.addAttributeOrGroup(attribute);
		return attribute;
	}

	public createAttributeGroup(operator: string, operatorLabel: string) {
		const attributeGroup = new AttributeGroup(this.builder, operator, operatorLabel);
		this.addAttributeOrGroup(attributeGroup);
		return attributeGroup;
	}

	// if no preceding attribute, insertion will be at the front of this group
	public addAttributeOrGroup(attributeOrGroup: Attribute|AttributeGroup, precedingAttributeOrGroup?: AttributeGroup|Attribute) {
		if (precedingAttributeOrGroup && precedingAttributeOrGroup.element.parent()[0] !== this.element[0]) {
			throw new Error('AttributeGroup.addAttributeOrGroup: precedingAttributeOrGroup is not a child of this group');
		}

		const oldParentGroup = attributeOrGroup.element.parent().data('attributeGroup');

		if (precedingAttributeOrGroup) {
			attributeOrGroup.element.insertAfter(precedingAttributeOrGroup.element);
		} else  {
			attributeOrGroup.element.prependTo(this.element);
		}

		this.element.trigger('cql:modified');
		if (oldParentGroup) {
			oldParentGroup.element.trigger('cql:modified');
		}
	}

	/* Get the object instances for all direct child attributes */
	public getAttributes(): Attribute[] {
		return this.element.children('.bl-token-attribute').map(function(i, el) {
			return $(el).data('attribute');
		}).get();
	}

	/* Get the object instances for all direct child attribute groups */
	public getAttributeGroups(): AttributeGroup[] {
		return this.element.children('.bl-token-attribute-group').map(function(i, el) {
			return $(el).data('attributeGroup');
		}).get();
	}

	public getCql() {
		const cqlStrings = [] as string[];

		this.element.children('.bl-token-attribute, .bl-token-attribute-group').each(function(index, element) {
			const instance = $(element).data('attributeGroup') || $(element).data('attribute');
			const elemCql = instance.getCql();

			if (elemCql && elemCql !== '') { // Do not push null, undefined or empty strings
				cqlStrings.push(elemCql);
			}
		});

		const joinedCql = cqlStrings.join(' ' + this.operator + ' ');
		if (this.isRoot) {
			return joinedCql;
		} else {
			return '(' + joinedCql  + ')';
		}
	}
}

// ----------------
// Class Attribute
// ----------------

export class Attribute {
	private readonly builder: QueryBuilder;
	private readonly id = generateId('attribute');
	private readonly idSelector = '#' + this.id;
	public readonly element: JQuery<HTMLElement>;
	private readonly $controls: {
		type: JQuery<HTMLSelectElement>;
		operator: JQuery<HTMLSelectElement>;
	};

	private uploadedValue = null as string|null;

	constructor(builder: QueryBuilder) {
		this.builder = builder;
		this.element = this._createElement();

		this.$controls = {
			type: this.element.find('[data-attribute-role="type"]') as JQuery<HTMLSelectElement>,
			operator: this.element.find('[data-attribute-role="operator"]') as JQuery<HTMLSelectElement>,
			// value_simple: this.element.find(this.idSelector + '_value_simple') as JQuery<HTMLInputElement>,
			// value_file: this.element.find(this.idSelector + '_value_file') as JQuery<HTMLInputElement>,
		};

		this._updateShownOptions(this.builder.settings.attribute.view.defaultAttribute);
	}

	private _createElement() {
		const view = $.extend({}, this.builder.settings.shared.view, this.builder.settings.attribute.view, { currentId: this.id });
		const partials = $.extend({}, templates.shared.partials, templates.attribute.partials);

		const $element = $(Mustache.render(templates.attribute.template, view, partials));
		this._prepareElement($element);
		return $element;
	}

	private _prepareElement($element: JQuery<HTMLElement>) {
		const self = this;
		$element.data('attribute', this);

		$element.on('click', '[data-attribute-role="delete"]', function() {
			const parentGroup = self.element.parent().data('attributeGroup') as AttributeGroup;
			// Remove the selectpickers first so they can gracefully tear down, prevents unclosable menu when deleting attribute with a dropdown open
			self.element.find('.selectpicker').each(function() { $(this).selectpicker('destroy'); });
			self.element.detach();
			parentGroup._removeIfEmpty();
			parentGroup.element.trigger('cql:modified');
		});

		// Show/hide elements for the selected attribute type
		// Such as case-sensitivity checkbox or comboboxes for when there is a predefined set of valid values
		$element.on('change', '[data-attribute-role="type"]', function() {
			const selectedValue = $(this).val() as string;
			self._updateShownOptions(selectedValue);
		});

		$element.on('change', '[data-attribute-role="file"]', this._onUploadChanged.bind(this));
		$element.on('click', '[data-attribute-role="edit"]', this._showModalEditor.bind(this));
		$element.on('click', '[data-attribute-role="clear"]', () => {
			$element.find('[data-attribute-role="file"]').val('').trigger('change');
		});

		$element.find('[data-attribute-role="type"]').val(self.builder.settings.attribute.view.defaultAttribute); // no need to trigger change yet, still initializing

		// Bind this last, so other handlers can perform the appropriate updates before we notify parents.
		$element.on('change', '[data-attribute-role="value"], [data-attribute-role="type"], [data-attribute-role="operator"], [data-attribute-role="case"]', () => $element.trigger('cql:modified'));

		$element.find('.selectpicker').selectpicker();
	}

	private _showModalEditor(event: JQuery.Event) {
		const self = this;

		// copy out current text to modal
		const $modalTextArea = this.builder.modalEditor.find('textarea').val(this.uploadedValue || '');

		this.builder.modalEditor.modal(); // show modal
		this.builder.modalEditor.one('hide.bs.modal', function() { // copy out changes once closed
			// A little dirty, to determine how the modal was closed, get the currently focused element
			// If the modal was closed through a button click, the responsible button will have focus
			// Only save the data if the clicked button as the data-save-edits attribute/property
			if ($(document.activeElement!).is('[data-save-edits]')) {
				self.uploadedValue = $modalTextArea.val() as string;
				self.element.trigger('cql:modified');
			} else if ($(document.activeElement!).is('[data-discard-value]')) {
				self.element.find('[data-attribute-role="file"]').val('').trigger('change');
			}
		});
	}

	private _onUploadChanged(event: JQuery.TriggeredEvent<HTMLInputElement>) {
		const self = this;
		const $fileEditButton = self.element.find('[data-attribute-role="edit"]');

		const file = event.target.files && event.target.files[0];
		self.element.attr('data-has-file', file != null ? '' : null);

		if (file == null) {
			$fileEditButton.text('No file selected...');
			self.uploadedValue = null;
			self.element.trigger('cql:modified');
		} else {
			const fr = new FileReader();
			fr.onload = function() {
				$fileEditButton.text(file.name);
				self.uploadedValue = fr.result as string;
				self.element.trigger('cql:modified');
			};
			fr.readAsText(file);
		}
	}

	private _updateShownOptions(selectedValue: string) {
		// First hide everything with a data-attribute-type value
		// Then unhide the one for our new selectedValue
		this.element.find('[data-attribute-type]').hide().filter('[data-attribute-type="' + selectedValue + '"]').show();
	}

	public set(controlName: keyof Attribute['$controls']|'case'|'val', val: string|boolean|string[], additionalSelector?: string) {
		if (controlName === 'case') {
			setValue(this.element.find('[data-attribute-type="' + additionalSelector + '"]')
				.find('[data-attribute-role="case"]'), val);
		} else if (controlName === 'val') {
			// correct value casing (if applicable)
			const ourSettings = this.builder.settings.attribute.view.attributes
				.flatMap<AttributeDef>((a: any) => a.options ? a.options : a)
				.find(a => a.attribute === additionalSelector);

			if (ourSettings && !ourSettings.caseSensitive && ourSettings.values && ourSettings.values.length) {
				const caseMap = ourSettings.values.reduce<{[k: string]: string}>((acc, v) => {
					acc[v.value.toLowerCase()] = v.value;
					return acc;
				}, {});

				val = [val]
					.flat()
					.filter((v): v is string => typeof v === 'string')
					.map(v => caseMap[v.toLowerCase()] || v);
			}
			setValue(this.element.find('[data-attribute-type="' + additionalSelector + '"]')
				.find('[data-attribute-role="value"]'), val);
		} else if (this.$controls[controlName]) {
			setValue(this.$controls[controlName], val);
		}
	}

	public getCql() {
		const type = this.$controls.type.val() as string;
		const operator = this.$controls.operator.val() as string;

		const $optionsContainer = this.element.find('[data-attribute-type="' + type + '"]');
		const caseSensitive = $optionsContainer.find('[data-attribute-role="case"]').is(':checked') || false;

		let values: string[];
		if (this.uploadedValue != null) {
			values = this.uploadedValue.trim().split(/\s+/g); // split on whitespace, across line breaks
		} else {
			const rawValue = $optionsContainer.find('[data-attribute-role="value"]').val() as string|string[];
			values = [rawValue].flat(2);
		}

		const callback = this.builder.settings.attribute.getCql;
		return callback(type, operator, caseSensitive, values);
	}
}

// ------------------
// Utility functions
// ------------------

const generateId = function() {
	let nextId = 0;
	return function(prefix: string) {
		return prefix + '_' + nextId++;
	};
}();

// Set values on input/select elements uniformly
const setValue = function($element: JQuery<HTMLElement>, val: any) {
	if (val != null) {
		if (val.constructor !== Array) {
			val = [val];
		}
	} else {
		val = [null];
	}

	if ($element.is(':checkbox')) {
		$element.prop('checked', val[0]).trigger('change');
	} else if ($element.is('select')) {
		if ($element.hasClass('selectpicker')) {
			$element.selectpicker('val', val).trigger('change');

			const actualValues = ([] as string[]).concat($element.selectpicker('val')); // might not always be array
			if (val.filter((v: any) => v!=null && !actualValues.includes(v)).length) {
				throw new Error('Could not set value(s) ' + val.join() + ' on selectpicker - list contains invalid values (use null to clear)');
			}
		} else {
			// deal with selects that don't have the "multiple" property
			const multiSelect = $element.prop('multiple');
			let hasSelected = false;
			$element.find('option').each(function(i, option) {
				const canSelect = !hasSelected || multiSelect;

				const select = canSelect && ($.inArray($(option).val(), val) !== -1);

				$(option).prop('selected', select);
				hasSelected = hasSelected || select;
			});
			$element.trigger('change');
		}
	} else if ($element.is(':input')) {
		// We know we're dealing with cql regex here, just pipe them together.
		$element.val(val.join('|')).trigger('change');
	}
};

function hasAttribute(builder: QueryBuilder, attributeId: string) {
	const attributes = builder.settings.attribute.view.attributes.flatMap<AttributeDef, any>((a: any) => a.options ? a.options : a);
	return attributes.find(att => att.attribute === attributeId) != null;
}

function getOperatorLabel(builder: QueryBuilder, operator: string) {
	const found = builder.settings.shared.view.operators.find(op => op.operator === operator);
	return found ? found.label : operator;
}

/**
 * Attempt to parse the query pattern and update the state of the query builder
 * to match it as much as possible.
 *
 * @param {string} pattern - cql query
 * @returns True or false indicating success or failure respectively
 */
function populateQueryBuilder(queryBuilder: QueryBuilder, pattern: string|null|undefined): boolean {
	if (pattern == null) {
		queryBuilder.reset();
		return true;
	} else if (!pattern) {
		return false;
	}

	try {
		const parsedCql = parseCql(pattern, queryBuilder.settings.attribute.view.defaultAttribute);
		const tokens = parsedCql.tokens;
		const within = parsedCql.within;
		if (tokens === null) {
			return false;
		}

		queryBuilder.reset();
		if (tokens.length > 0) {
			// only clear the querybuilder when we're putting something back in
			queryBuilder.getTokens().forEach(token => token.element.remove());
		}
		if (within) {
			queryBuilder.set('within', within);
		}

		tokens.forEach(token => {
			const tokenInstance = queryBuilder.createToken();

			// clean the root group of all contents
			tokenInstance.rootAttributeGroup.getAttributes().forEach(attribute => attribute.element.remove());
			tokenInstance.rootAttributeGroup.getAttributeGroups().forEach(group => group.element.remove());

			tokenInstance.set('beginOfSentence', !!token.leadingXmlTag && token.leadingXmlTag.name === 's');
			tokenInstance.set('endOfSentence', !!token.trailingXmlTag && token.trailingXmlTag.name === 's');
			tokenInstance.set('optional', token.optional || false);

			if (token.repeats) {
				tokenInstance.set('minRepeats', token.repeats.min);
				tokenInstance.set('maxRepeats', token.repeats.max);
			}

			function doOp(op: undefined|CQLAttribute|CQLBinaryOp, parentAttributeGroup: AttributeGroup, level: number) {
				if (op == null) {
					return;
				}

				if (op.type === 'binaryOp') {
					const label = op.operator === '&' ? 'AND' : 'OR'; // TODO get label internally in builder
					if (op.operator !== parentAttributeGroup.operator) {

						if (level === 0) {
							parentAttributeGroup.operator = op.operator;
							parentAttributeGroup.operatorLabel = getOperatorLabel(queryBuilder, op.operator);
						} else if (parentAttributeGroup.operator !== op.operator) {
							parentAttributeGroup = parentAttributeGroup.createAttributeGroup(op.operator, label);
						}
					}

					// inverse order, since new elements are inserted at top..
					doOp(op.right, parentAttributeGroup, level + 1);
					doOp(op.left, parentAttributeGroup, level + 1);
				} else if (op.type === 'attribute') {
					if (!hasAttribute(queryBuilder, op.name)) {
						return;
					}

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
							(op.operator as string) = 'ends with';
							op.value = op.value.substr(2);
						} else if (op.value.indexOf('.*') === op.value.length -2) {
							(op.operator as string) = 'starts with';
							op.value = op.value.substr(0, op.value.length-2);
						}
					}

					attributeInstance.set('operator', op.operator);
					attributeInstance.set('type', op.name);
					attributeInstance.set('val', op.value.split('|'), op.name);
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
