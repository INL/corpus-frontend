/* global Mustache */

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

// Probably need to name this properly instead of being so generic
window.querybuilder = (function() {
	'use strict';

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
	var templates = {

		queryBuilder: {
			template: 
				'<div class="bl-token-container">' +
					'{{>createTokenButton}}' +
				'</div>' +
				'{{>withinSelect}}' +
				'{{>modalEditor}}',
			
			partials: {
				createTokenButton:
					'<button type="button" class="btn btn-danger bl-token-create bl-prevent-sort" title="Insert another token"><span class="glyphicon glyphicon-plus"></span></button>',
				
				modalEditor: 
					'<div class="bl-modal-editor modal fade" tabindex="-1" role="dialog">' +
						'<div class="modal-dialog" role="document">' +
							'<div class="modal-content">' +
								'<div class="modal-header">' +
									'<button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>' +
									'<h4 class="modal-title">Edit</h4>' +
								'</div>' +
								'<div class="modal-body">' +
									'<textarea class="form-control" rows="10" style="width:100%;overflow:auto;resize:none;white-space:pre;"></textarea>' +
								'</div>' +
								'<div class="modal-footer">' +
									'<button type="button" class="btn btn-default" data-dismiss="modal">Cancel</button>' +
									'<button type="button" class="btn btn-primary" data-dismiss="modal" data-save-edits>Save changes</button>' +
								'</div>' +
							'</div>' +
						'</div>' +
					'</div>',

				withinSelect: 
					'<label>Within:</label>' +
					'<div class="btn-group bl-within-select clearfix" data-toggle="buttons" id="within_select" style="display:block;">' +
						'{{#withinSelectOptions}}' +
							'<label class="btn btn-default">' +
								'<input type="radio" autocomplete="off" name="within" value="{{value}}">{{label}}' +
							'</label>' +
						'{{/withinSelectOptions}}' +
					'</div>',
			},
		},

		token: {
			template: 
				'<div class="panel panel-danger bl-token" id="{{currentId}}">' +
					'{{>head_root}}' +
					'{{>body_root}}' +
				'</div>',

			partials: {
				head_root: 
					'<div class="panel-heading clearfix">' +
						'{{>head_handle}}' +
						'{{>head_deleteButton}}' +
						'{{>head_cqlPreview}}' +
					'</div>',
				head_handle:
					'<span class="glyphicon glyphicon-resize-horizontal bl-sort-handle" style="margin-right:5px;" title="Drag here to move this token"></span>',
				head_deleteButton:
					'<button type="button" class="close" area-label="delete" title="remove token"><span aria-hidden="true">&times;</span></button>',
					
				head_cqlPreview:
					'<span id="{{currentId}}_cql_preview">Generated cql will appear here.</span>',
			
				body_root:
					'<div class="panel-body" id="{{currentId}}_panel_body">' +
						'{{>body_tab_header}}' +
						'{{>body_tab_container}}' +
					'</div>',
				
				body_tab_header:
					'<ul class="nav nav-tabs">' +
						'<li class="active"><a data-toggle="tab" href="#{{currentId}}_tab_attributes">attributes</a></li>' +
						'<li><a data-toggle="tab" href="#{{currentId}}_tab_properties">properties</a></li>' +
					'</ul>',
				body_tab_container:
					'<div class="tab-content">' +
						'{{>body_tab_attributes}}' +
						'{{>body_tab_properties}}' +
					'</div>',

				body_tab_attributes:
					'<div id="{{currentId}}_tab_attributes" class="tab-pane active" style="padding: 25px 15px;">' +
					'</div>',

				body_tab_properties:
					'<div id="{{currentId}}_tab_properties" class="tab-pane" style="padding: 10px 15px 25px 15px;">' +
						'<div class="checkbox">' +
							'<label title="Token is optional"><input type="checkbox" id="{{currentId}}_property_optional">Optional</label>' +
						'</div>' +
						'<div class="checkbox">' +
							'<label title="Token must occur at beginning of sentence"><input type="checkbox" id="{{currentId}}_property_sentence_start">Begin of sentence</label>' +
						'</div>' +
						'<div class="checkbox">' +
							'<label title="Token must occur at end of sentence"><input type="checkbox" id="{{currentId}}_property_sentence_end">End of sentence</label>' +
						'</div>' +
						'<div class="input-group" style="width:318px;">' +
							'<span class="input-group-addon">repeats</span>' +
							'<input type="text" class="form-control" value="1" id="{{currentId}}_property_repeats_min">' +
							'<span class="input-group-addon" style="border-left-width:0px; border-right-width:0px;">to</span>' +
							'<input type="text" class="form-control" value="1" id="{{currentId}}_property_repeats_max">' +
							'<span class="input-group-addon">times</span>' +
						'</div>' +
					'</div>'
			}
		},

		attributeGroup: {
			template: 
				'<div class="well bl-token-attribute-group" id="{{currentId}}">' +
					'{{>create_attribute_dropdown}}'+
				'</div>'
		},

		attribute: {
			template:
				'<div class="bl-token-attribute" id="{{currentId}}">' +
					'<div class="bl-token-attribute-main">' +
						'{{>delete_attribute_button}}' +
						'<select class="selectpicker" data-width="auto" data-container="body" data-style="btn btn-sm btn-default bl-no-border-radius-right" id="{{currentId}}_type">' +
							'{{#attributes}}' +
							'<option value="{{attribute}}">{{label}}</option>' +
							'{{/attributes}}' +
						'</select>' +
						'<select class="selectpicker" data-width="54px"; data-container="body" data-style="btn btn-sm btn-danger bl-selectpicker-hide-caret bl-no-border-radius" id="{{currentId}}_operator">' +
							'{{#comparators}}' +
							'<optgroup>' +
								'{{#.}}' +
								'<option value="{{value}}">{{label}}</option>' +
								'{{/.}}' +
							'</optgroup>' +
							'{{/comparators}}' +
						'</select>' +
						'{{>main_input}}' +
						'{{>create_attribute_dropdown}}' +
					'</div>' +
					'{{#attributes}}' +
						'<div data-attribute-type="{{attribute}}" style="display:none;">' +
						'{{#caseSensitive}}' +
							'<div class="checkbox">' +
								'<label>' +
									'<input type="checkbox" data-attribute-role="case">' +
									'Case&nbsp;and&nbsp;diacritics&nbsp;sensitive' +
								'</label>' +
							'</div>' +
						'{{/caseSensitive}}' +
						'</div>' +
					'{{/attributes}}' +
				'</div>',

			partials: {
				delete_attribute_button:
					'<span class="glyphicon glyphicon-remove text-danger" id="{{currentId}}_delete" style="flex-grow:0;cursor:pointer;" title="Remove this attribute"></span>',

				main_input:
					'<span class="bl-token-attribute-main-input">' +
						'<textarea id="{{currentId}}_value_file" class="hidden"></textarea>' +
						'<input id="{{currentId}}_value_simple" type="text" class="form-control input-sm bl-no-border-radius bl-hover-back bl-has-file-hidden" style="position:relative;">' +
						'<button type="button" class="bl-token-attribute-file-edit btn btn-default btn-sm bl-no-border-radius bl-hover-back bl-has-file-shown" title="Edit your uploaded values">(filename)</button>' +
						'<button type="button" class="btn btn-sm btn-default bl-no-border-radius-right bl-input-upload-button bl-hover-front" title="Upload a list of values">' +
							'<input type="file" accept="text/*" class="bl-input-upload">' +
							'<span class="glyphicon glyphicon-open"></span>' +
						'</button>' +
					'</span>'
			}
		},
		
		operatorLabel: {
			template:
				'<div class="bl-token-attribute-group-label">' +
					'{{label}}' +
				'</div>',

			partials: {}
		},
		
		shared: {
			partials: {
				create_attribute_dropdown: 
					'<div class="dropup bl-create-attribute-dropdown">' +
						'<button type="button" class="btn btn-sm btn-default dropdown-toggle" data-toggle="dropdown"><span class="glyphicon glyphicon-plus"></span>&#8203;</button>' +
						'<ul class="dropdown-menu">' +
							'{{#operators}}' +
							'<li><a href="#" onclick="$(this).trigger(\'cql:attribute:create\', { operator: \'{{operator}}\', operatorLabel: \'{{label}}\' }); return false;">'+
								'<span class="glyphicon glyphicon-plus-sign text-success"></span> {{label}}</a></li>'+
							'{{/operators}}'+
						'</ul>'+
					'</div>',
			}
		}
	};

	var DEFAULTS = {
		
		queryBuilder: {
			view: {
				// The first option is automatically selected on init
				// Empty value will omit the "within" tag from the query, essentially serving as a default option
				// Syntax to transform the value into <value/> is inserted when the query is generated
				withinSelectOptions: [
					{value:'', 		label:'document'},
					{value:'p', 	label:'paragraph'},
					{value:'s', 	label:'sentence'},
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
					},
					{
						attribute: 'lemma',
						label: 'lemma',
						caseSensitive: true,
					},
					{
						attribute: 'pos',
						label: 'Part of speech',
						caseSensitive: false,
					}
				]
			},

			getCql: function(attribute, comparator, caseSensitive, values) {
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

	//-------------------
	// Class Querybuilder
	//-------------------
		
	var QueryBuilder = function($rootElement, options) {
		if (!(this instanceof QueryBuilder)) { // not called using "new"
			return new QueryBuilder($rootElement, options);
		}

		// Use extendext so arrays in the defaults are replaced instead of merged with those in options
		this.settings = $.extendext(true, 'replace', {}, DEFAULTS, options);
		this._prepareElement($rootElement);
		
		this.element = $rootElement;
		this.createTokenButton = $rootElement.find('.bl-token-create');
		this.modalEditor = this.element.find('.bl-modal-editor');
		this.withinSelect = this.element.find('#within_select');
		
		this.createTokenButton.click();
	};

	QueryBuilder.prototype._prepareElement = function($element) {
		$element
		.html(Mustache.render(templates.queryBuilder.template, this.settings.queryBuilder.view, templates.queryBuilder.partials))
		.data('builder', this)
		.addClass('bl-querybuilder-root');
		
		// Enable sorting tokens within the container
		$element.find('.bl-token-container').sortable({
			items: '>*:not(.bl-prevent-sort)',
			handle: '.bl-sort-handle',
			placeholder: 'bl-sort-placeholder-token',
			forcePlaceholderSize: true,
	
			cursor: 'move',
			tolerance: 'pointer',
			
			start: function(e, ui ){
				ui.placeholder.height(ui.helper.outerHeight());
				ui.placeholder.width(ui.helper.outerWidth());
			},
			update: function() {
				$element.trigger('cql:modified');
			}
		})

		$element.find('.bl-token-create').on('click', this.createToken.bind(this));
		$element.find('#within_select')
			.on('change', function() { $element.trigger('cql:modified'); })
			.find('input').first().attr('checked', 'checked')
			.parent().addClass('active');
		
		return $element;
	};

	// create a new token and insert it in the root container
	QueryBuilder.prototype.createToken = function() {
		var token = new Token(this);

		token.element.insertBefore(this.createTokenButton);
		this.element.trigger('cql:modified');

		return token;
	};

	QueryBuilder.prototype.getTokens = function() {
		return this.element.children('.bl-token-container').children('.bl-token').map(function(i, elem) {
			return $(elem).data('token');
		}).get();
	};

	QueryBuilder.prototype.getCql = function() {
		var cqlParts = [];
		
		this.element.find('.bl-token').each(function(index, element){
			cqlParts.push($(element).data('token').getCql());
		});

		var within = this.withinSelect.find('input:checked').first().val();
		if (within != null && within.length) // ignore empty and null 
			cqlParts.push('within', '<'+ within+'/>');
		
		return cqlParts.join(' ') || null;
	};

	// When setting 'within', val should only be the name, without surrounding </>
	QueryBuilder.prototype.set = function(controlName, val) {
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


	QueryBuilder.prototype.reset = function() {
		this.element.find('.bl-token').remove();
		this.createToken();
		this.withinSelect.find('input').first().parent().button('toggle');
	};

	//----------
	// Class Token
	//----------

	var Token = function(parentBuilder) {
		if (!(this instanceof Token)) { // not called using "new"
			return new Token(parentBuilder);
		}

		this.builder = parentBuilder;
		this.element = this._createElement();

		// Init controls before adding any child elements
		var baseId = '#' + this.element.attr('id');
		this.$controls = {
			'optional': this.element.find(baseId + '_property_optional'),
			'minRepeats': this.element.find(baseId + '_property_repeats_min'),
			'maxRepeats': this.element.find(baseId + '_property_repeats_max'),
			'beginOfSentence': this.element.find(baseId + '_property_sentence_start'),
			'endOfSentence': this.element.find(baseId + '_property_sentence_end')
		};
		
		this.rootAttributeGroup = this._createRootAttributeGroup();
		this.rootAttributeGroup.createAttribute();
	};

	Token.prototype._createElement = function() {
		var view = $.extend({}, this.builder.settings.token.view, { currentId: generateId('token') });
		var $element = $(Mustache.render(templates.token.template, view, templates.token.partials));

		this._prepareElement($element);
		
		return $element;
	};

	Token.prototype._prepareElement = function($element) {
		$element.data('token', this);
		$element.find('input, textarea').on('change', function() {
			$element.trigger('cql:modified');
		});
		
		var self = this;
		$element.find('.close').on('click', function(){
			$element.remove();
			self.builder.element.trigger('cql:modified');
		});
				
		$element.on('cql:modified', this._updateCql.bind(this));
	};

	Token.prototype._createRootAttributeGroup = function() {
		var baseId = '#' + this.element.attr('id');

		var group = new AttributeGroup(this.builder, this.builder.settings.token.rootOperator.operator, this.builder.settings.token.rootOperator.label);
		group.element.removeClass('well');
		group.element.appendTo(this.element.find(baseId + '_tab_attributes'));
		group.isRoot = true;

		return group;
	};

	Token.prototype._updateCql = function() {
		var baseId = '#' + this.element.attr('id');

		var $cqlPreviewElement = this.element.find(baseId + '_cql_preview');
		var $tokenPanelHeading = this.element.find('.panel-heading');
		var $tokenPanelBody = this.element.find('.panel-body');
		
		var cqlString = this.getCql();
		if (cqlString.length > 250)
			cqlString = cqlString.slice(0, 245) + '…';
		$cqlPreviewElement.text(cqlString);
		
		// Set an explicit max-width to our header (containing the CQL preview string)
		// Why? because otherwise text won't wrap and the token could become very wide for long queries.
		// We want the token body to control the width of the entire token, and the token head to expand and contract together with the token body.
		// There is no way to do this cleanly in pure css currently.
		// We also need to take care to set a default when this code runs while the element isn't visible, or isn't attached to the DOM. 
		// When this happens, jquery doesn't return a sensible outerWidth value for our body. 
		// we can't know if the token body is wider than this default (currently 348px), so it will be wrong if the token body is wider than a usual empty token, but this is rare.
		var width = parseInt($tokenPanelBody.outerWidth()) || 0;
		$tokenPanelHeading.css({
			'width': '100%',
			'max-width': Math.max(width, 348) + 'px'
		})	
	};

	Token.prototype.set = function(controlName, val) {
		if (this.$controls[controlName])
			setValue(this.$controls[controlName], val);
	};

	Token.prototype.getCql = function() {
		var optional = this.$controls['optional'].prop('checked');
		var minRepeats = parseInt(this.$controls['minRepeats'].val());
		var maxRepeats = parseInt(this.$controls['maxRepeats'].val());
		var beginOfSentence = this.$controls['beginOfSentence'].prop('checked');
		var endOfSentence = this.$controls['endOfSentence'].prop('checked');
		
		var outputParts = [];
		
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
				if (maxRepeats != Infinity) { // infinite is empty field instead of max value
					outputParts.push('{'+minRepeats+','+maxRepeats+'}');
				} else {
					outputParts.push('{'+minRepeats+', }');
				}
			} 
			else if (minRepeats == maxRepeats && minRepeats != 1) { // 1 is the default so if min == max == 1 then we don't need to do anything
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
	};

	//---------------------
	// Class AttributeGroup
	//---------------------

	var AttributeGroup = function(parentBuilder, operator, operatorLabel) {
		if (!(this instanceof AttributeGroup)) { // not called using "new"
			return new AttributeGroup(parentBuilder, operator, operatorLabel);
		}

		this.builder = parentBuilder;
		this.operator = operator;
		this.operatorLabel = operatorLabel;
		this.element = this._createElement();
	};

	AttributeGroup.prototype._createElement = function() {
		var view = $.extend({}, this.builder.settings.shared.view, this.builder.settings.attributeGroup.view, { currentId: generateId('attribute_group') });
		var partials = $.extend({}, templates.shared.partials, templates.attributeGroup.partials);
		
		var $element = $(Mustache.render(templates.attributeGroup.template, view, partials));
		this._prepareElement($element);
		return $element;
	};

	AttributeGroup.prototype._prepareElement = function($element) {
		$element.data('attributeGroup', this);
		$element.on('cql:modified', this._updateLabels.bind(this));
		$element.on('cql:attribute:create', this._createAttribute.bind(this));
	};

	AttributeGroup.prototype._createAttribute = function(attributeCreateEvent, data) {
		// The attribute for which the create button was clicked (if null, the button was our own button)
		var originAttribute = $(attributeCreateEvent.target).parents('.bl-token-attribute').data('attribute');
		
		var newAttribute = new Attribute(this.builder);
		var newGroup;
		
		/* 
		 * If the new attribute was created at the bottom of the group, wrap all existing attributes inside a new group
		 * then swap this group's operator to the new operator, and append the new attribute
		 */
		
		// we can just swap the operator if this contains only 1 attribute
		if (this.element.children('.bl-token-attribute, .bl-token-attribute-group').size() <= 1) {
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
				newGroup.addAttributeOrGroup(originAttribute);
				newGroup.addAttributeOrGroup(newAttribute);
			}
			else {
				// Create a new group, put in everything inside this group
				// Then swap our operator and add the new attribute
				$(this.element.children('.bl-token-attribute, .bl-token-attribute-group').get().reverse()).each(function(index, element) {
					var instance = $(element).data('attribute') || $(element).data('attributeGroup');
					newGroup.addAttributeOrGroup(instance);
				});
				
				this.addAttributeOrGroup(newGroup);
				this.addAttributeOrGroup(newAttribute, newGroup);
				newGroup.operator = this.operator;
				newGroup.operatorLabel = this.operatorLabel;
				this.operator = data.operator;
				this.operatorLabel = data.operatorLabel;
			}
		}
		else {
			if (originAttribute) { // Insert below existing attribute
				this.addAttributeOrGroup(newAttribute, originAttribute);
			}
			else { // Append at end of this group
				var $lastChild = this.element.children('.bl-token-attribute, .bl-token-attribute-group').last();
				var lastChildData = $lastChild.data('attributeGroup') || $lastChild.data('attribute');
				
				this.addAttributeOrGroup(newAttribute, lastChildData);				
			}
		}
		
		this._updateLabels();
		if (newGroup)
			newGroup._updateLabels();
		
		this.element.trigger('cql:modified');
		return false;
	};
	
	AttributeGroup.prototype._removeIfEmpty = function() {
		var $children = this.element.children('.bl-token-attribute, .bl-token-attribute-group');
		var parentGroup = this.element.parent().data('attributeGroup');
		var self = this;
		
		if (this.isRoot) {
			// Never hide root group, should be able to contain 0 members to indicate "[]", or any word
			return;
		}

		if ($children.length <= 1) {
			// Move children before removing this, so we can give them the correct index based on this
			$children.each(function(index, element) {
				var instance = $(element).data('attributeGroup') || $(element).data('attribute');
				parentGroup.addAttributeOrGroup(instance, self);
			});
			
			this.element.remove();
			parentGroup._updateLabels();
			parentGroup.element.trigger('cql:modified');
		}
	};

	AttributeGroup.prototype._updateLabels = function() {
		this.element.children('.bl-token-attribute-group-label').remove();

		var self = this;
		this.element.children('.bl-token-attribute, .bl-token-attribute-group').each(function(index, element) {
			var $newLabel = $(Mustache.render(templates.operatorLabel.template, {label: self.operatorLabel}, templates.operatorLabel.partials));
			$newLabel.insertAfter(element);
		});
		this.element.children('.bl-token-attribute-group-label').last().remove();
	};

	
	AttributeGroup.prototype.createAttribute = function() {
		var attribute = new Attribute(this.builder);
		this.addAttributeOrGroup(attribute);
		return attribute;
	};

	AttributeGroup.prototype.createAttributeGroup = function(operator, operatorLabel) {
		var attributeGroup = new AttributeGroup(this.builder, operator, operatorLabel);
		this.addAttributeOrGroup(attributeGroup);
		return attributeGroup;
	};

	// if no preceding attribute, insertion will be at the front of this group
	AttributeGroup.prototype.addAttributeOrGroup = function(attributeOrGroup, precedingAttributeOrGroup) {
		if (precedingAttributeOrGroup && precedingAttributeOrGroup.element.parent().index(0) !== this.element.index(0)) {
			throw new Error('AttributeGroup.addAttributeOrGroup: precedingAttributeOrGroup is not a child of this group');
		}

		var oldParentGroup = attributeOrGroup.element.parent().data('attributeGroup');


		if (precedingAttributeOrGroup){
			attributeOrGroup.element.insertAfter(precedingAttributeOrGroup.element);
		} else  {
			attributeOrGroup.element.prependTo(this.element);
		}
		
		this.element.trigger('cql:modified');
		if (oldParentGroup) {
			oldParentGroup.element.trigger('cql:modified');
		}
	};

	/* Get the object instances for all direct child attributes */
	AttributeGroup.prototype.getAttributes = function() {
		return this.element.children('.bl-token-attribute').map(function(i, el) {
			return $(el).data('attribute');
		}).get();
	};

	/* Get the object instances for all direct child attribute groups */
	AttributeGroup.prototype.getAttributeGroups = function() {
		return this.element.children('.bl-token-attribute-group').map(function(i, el) {
			return $(el).data('attributeGroup');
		}).get();
	};

	AttributeGroup.prototype.getCql = function() {
		var cqlStrings = [];
			
		this.element.children('.bl-token-attribute, .bl-token-attribute-group').each(function(index, element) {
			var instance = $(element).data('attributeGroup') || $(element).data('attribute');
			var elemCql = instance.getCql();
			
			if (elemCql && elemCql !== '') { // Do not push null, undefined or empty strings
				cqlStrings.push(elemCql);
			}
		});

		var joinedCql = cqlStrings.join(' ' + this.operator + ' ');
		if (this.isRoot) {
			return joinedCql;
		} else {
			return '(' + joinedCql  + ')';
		}
	};

	//----------------
	// Class Attribute
	//----------------

	var Attribute = function(parentBuilder) {
		if (!(this instanceof Attribute)) { // not called using "new"
			return new Attribute(parentBuilder);
		}

		this.builder = parentBuilder;
		this.element = this._createElement();

		var baseId = '#' + this.element.attr('id');
		this.$controls = {
			'type': this.element.find(baseId + '_type'),
			'operator': this.element.find(baseId + '_operator'),
			'value_simple': this.element.find(baseId + '_value_simple'),
			'value_file': this.element.find(baseId + '_value_file'),
		};
	};

	Attribute.prototype._createElement = function(){
		var view = $.extend({}, this.builder.settings.shared.view, this.builder.settings.attribute.view, { currentId: generateId('attribute') });
		var partials = $.extend({}, templates.shared.partials, templates.attribute.partials);
		
		var $element = $(Mustache.render(templates.attribute.template, view, partials));
		this._prepareElement($element);
		return $element;
	};

	Attribute.prototype._prepareElement = function($element) {
		var baseId = '#' + $element.attr('id');
		
		$element.data('attribute', this);

		$element.find('.selectpicker').selectpicker();
		$element.find('.selectpicker, input, textarea').on('change', function() {$element.trigger('cql:modified');});

		// Show/hide elements for the selected attribute type
		// Such as case-sensitivity checkbox or comboboxes for when there is a predefined set of valid values
		var self = this;
		$element.find(baseId + '_type').on('loaded.bs.select changed.bs.select', function() { 
			var selectedValue = $(this).val();
			self._updateShownOptions(selectedValue); 
		});
		
		$element.find(baseId + '_delete').on('click', function() {
			var parentGroup = self.element.parent().data('attributeGroup');
			self.element.detach();
			parentGroup._removeIfEmpty();
			parentGroup.element.trigger('cql:modified');
		});

		$element.find('.bl-input-upload').on('change', this._onUploadChanged.bind(this));

		$element.find('.bl-token-attribute-file-edit').on('click', this._showModalEditor.bind(this));
	};

	Attribute.prototype._showModalEditor = function(/*event*/) {
		var baseId = '#' + this.element.attr('id');
		var $fileText = this.element.find(baseId + '_value_file');
		var $modalTextArea = this.builder.modalEditor.find('textarea');
		
		$modalTextArea.val($fileText.val()); //copy out current text to modal
		this.builder.modalEditor.modal(); // show modal
		this.builder.modalEditor.one('hide.bs.modal', function() { // copy out changes once closed
			// A little dirty, to determine how the modal was closed, get the currently focused element
			// If the modal was closed through a button click, the responsible button will have focus
			// Only save the data if the clicked button as the data-save-edits attribute/property

			if ($(document.activeElement).is('[data-dismiss][data-save-edits], [data-toggle][data-save-edits]')) {
				$fileText
					.val($modalTextArea.val())
					.trigger('change');
			}
		});
	};

	Attribute.prototype._onUploadChanged = function(event) {
		if (!(window.FileReader && window.File && window.FileList && window.Blob))
			return;
		
		var baseId = '#' + this.element.attr('id');
		var $inputContainer = this.element.find('.bl-token-attribute-main-input');
		var $fileText = $inputContainer.find(baseId + '_value_file');
		var $fileEditButton = $inputContainer.find('.bl-token-attribute-file-edit');

		var file = event.target.files && event.target.files[0];
		if (file == null) {
			$inputContainer.removeAttr('data-has-file');
			$fileEditButton.text('No file selected...');
			$fileText.val('').trigger('change');
		}
		else {
			var fr = new FileReader();
			fr.onload = function() {
				$inputContainer.attr('data-has-file', '');
				$fileEditButton.text(file.name);
				$fileText.val(fr.result).trigger('change');
			};
			fr.readAsText(file);
		}
	};

	Attribute.prototype._updateShownOptions = function(selectedValue) {
		// First hide everything with a data-attribute-type value
		// Then unhide the one for our new selectedValue
		this.element.find('[data-attribute-type]').hide().filter('[data-attribute-type="' + selectedValue + '"]').show();
	};


	Attribute.prototype.set = function(controlName, val, additionalSelector) {
		if (this.$controls[controlName])
			setValue(this.$controls[controlName], val);
		else if (controlName === 'case') {
			setValue(this.element.find('[data-attribute-type="' + additionalSelector + '"]')
				.find('[data-attribute-role="case"]'), val);
		} else if (controlName === 'val') {
			if (!additionalSelector) { // Write to whatever is in focus/use right now
				var hasFile	= this.element.find('.bl-token-attribute-main-input').is('[data-has-file]');
				if (hasFile)
					setValue(this.$controls['value_file'], val);
				else 
					setValue(this.$controls['value_simple'], val);
			} else {
				if (additionalSelector === 'file')
					setValue(this.$controls['value_file'], val);
				else if (additionalSelector === 'simple')
					setValue(this.$controls['value_simple'], val);
			}
		}
	};

	Attribute.prototype.getCql = function() {
		
		var hasFile		= this.element.find('.bl-token-attribute-main-input').is('[data-has-file]');
		
		var type 		= this.$controls['type'].val();
		var operator 	= this.$controls['operator'].val();
		
		var $optionsContainer = this.element.find('[data-attribute-type="' + type + '"]');
		var caseSensitive = $optionsContainer.find('[data-attribute-role="case"]').is(':checked') || false;
		
		var rawValue;
		var values		= [];
		if (hasFile) {
			rawValue = this.$controls['value_file'].val() || '';
			var trimmedLines = rawValue.trim().split(/\s*[\r\n]+\s*/g); // split on line breaks, ignore empty lines.
			values = values.concat(trimmedLines);
		} else {
			rawValue = this.$controls['value_simple'].val() || '';
			values = values.concat(rawValue);
		}
		
		var callback = this.builder.settings.attribute.getCql;
		return callback(type, operator, caseSensitive, values);
	};

	//------------------
	// Utility functions
	//------------------

	var generateId = function() {
		var nextId = 0;
		return function(prefix) {
			return prefix + '_' + nextId++;
		};
	}();

	// Set values on input/select elements uniformly
	var setValue = function($element, val) {
		if (val != null) {
			if (val.constructor !== Array)
				val = [val];
		} else {
			val = [null];
		}

		if ($element.is(':checkbox')) {
			$element.prop('checked', val[0]);
		} else if ($element.is('select')) {
			if ($element.hasClass('selectpicker'))
				$element.selectpicker('val', val);
			else {
				// deal with selects that don't have the "multiple" property
				var multiSelect = $element.prop('multiple');
				var hasSelected = false;
				$element.find('option').each(function(i, option) {
					var canSelect = !hasSelected || multiSelect;
					
					var select = canSelect && ($.inArray($(option).val(), val) !== -1);

					$(option).prop('selected', select);
					hasSelected |= select;
				});
			}
		} else if ($element.is(':input')) {
			$element.val(val[0]);
		}
	};

	
	//---------------
	// non-object api
	//---------------
	
	return {
		createQueryBuilder: function($rootElement, options) {
			return new QueryBuilder($rootElement, options);
		}
	};

})();