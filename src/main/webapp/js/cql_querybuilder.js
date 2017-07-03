// Probably need to name this properly instead of being so generic

window.querybuilder = (function() {
	"use strict";

	var templates = {
		createTokenButton: {
			template:
				'<button type="button" class="btn btn-danger bl-token-create bl-prevent-sort"><span class="glyphicon glyphicon-plus"></span></button>',

			partials: {}
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
						'{{>head_collapseButton}}' +
						'{{>head_cqlPreview}}' +
					'</div>',
				head_handle:
					'<span class="glyphicon glyphicon-sort bl-sort-handle" style="margin-right:5px;"></span>',
				head_collapseButton:
					'<button type="button" class="btn btn-default pull-right bl-collapse-button" data-toggle="collapse" data-target="#{{currentId}}_panel_body" style="margin-left:5px;"></button>',
				head_cqlPreview:
					'<span id="{{currentId}}_cql_preview">This is a long string to test width,' +
					'but generated cql here [word="test" attribute="value"]{1,2}' +
					'now with even more text so we span onto line number 3 or maybe even 4 and this will have to work</span>',
			

				body_root:
					'<div class="panel-body collapse in" id="{{currentId}}_panel_body">' +
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
							'<label><input type="checkbox" id="{{currentId}}_property_optional">Optional</label>' +
						'</div>' +
						'<div class="checkbox">' +
							'<label><input type="checkbox" id="{{currentId}}_property_sentence_start">Begin of sentence</label>' +
						'</div>' +
						'<div class="checkbox">' +
							'<label><input type="checkbox" id="{{currentId}}_property_sentence_end">End of sentence</label>' +
						'</div>' +
						'<div class="input-group" style="width:318px;">' +
							'<span class="input-group-addon">repeats</span>' +
							'<input type="text" class="form-control" value="1" id="{{currentId}}_property_repeats_min">' +
							'<span class="input-group-addon">to</span>' +
							'<input type="text" class="form-control" value="1" id="{{currentId}}_property_repeats_max">' +
							'<span class="input-group-addon">times</span>' +
						'</div>' +
					'</div>'
			}
		},

		attributeGroup: {
			template: 
				'<div class="well bl-token-attribute-group" id="{{currentId}}">' +
				'</div>'
		},

		attribute: {
			template:
				'<div class="bl-token-attribute" id="{{currentId}}">' +
					'<div class="bl-token-attribute-main">' +
						'{{>delete_attribute_button}}' +
						'<select class="selectpicker" data-width="auto" data-style="btn btn-sm btn-default bl-no-border-radius-right" id="{{currentId}}_type" style="flex-grow:0;">' +
							'{{#attributes}}' +
							'<option value="{{attribute}}">{{label}}</option>' +
							'{{/attributes}}' +
						'</select>' +
						'<select class="selectpicker" data-width="54px"; data-style="btn btn-sm btn-danger bl-selectpicker-hide-caret bl-no-border-radius" id="{{currentId}}_operator" style="flex-grow:0;">' +
							'{{#comparators}}' +
							'<optgroup>' +
								'{{#.}}' +
								'<option>{{.}}</option>' +
								'{{/.}}' +
							'</optgroup>' +
							'{{/comparators}}' +
						'</select>' +
						'<input type="text" class="form-control input-sm bl-no-border-radius" id="{{currentId}}_value" style="flex-grow:1;flex-basis:1px;width:1px;min-width:110px;">' +
						'{{>create_attribute_dropdown}}' +
					'</div>' +
					'{{#attributes}}' +
						'<div data-attribute-type="{{attribute}}">' +
						'{{#caseSensitive}}' +
							'<div class="checkbox">' +
								'<label>' +
									'<input type="checkbox" data-attribute-role="case">' +
									'Case&nbsp;sensitive' +
								'</label>' +
							'</div>' +
						'{{/caseSensitive}}' +
						'</div>' +
					'{{/attributes}}' +
				'</div>'
				,

			partials: {
				create_attribute_dropdown: 
					'<div class="dropdown" style="flex-grow:0;">' +
						'<button type="button" class="btn btn-sm btn-default dropdown-toggle bl-no-border-radius-left" data-toggle="dropdown" style="border-left:none;"><span class="glyphicon glyphicon-plus"></span>&#8203;</button>' +
						'<ul class="dropdown-menu">' +
							'{{#operators}}' +
								'<li><a href="#" data-bl-token-attribute-group-operator="{{operator}}" data-bl-token-attribute-group-operator-label="{{label}}" onclick="return false;"><span class="glyphicon glyphicon-plus-sign text-success"></span> {{label}}</a></li>' +
							'{{/operators}}' +
							'<!--<li class="divider"></li>' +
							'<li><a href="#" id="{{currentId}}_delete"><span class="glyphicon glyphicon-remove-sign text-danger" onclick="return false"></span></a></li>-->' +
						'</ul>' +
					'</div>',
				delete_attribute_button:
					'<span class="glyphicon glyphicon-remove text-danger" id="{{currentId}}_delete" style="flex-grow:0;cursor:pointer;"></span>'
			}
		},

		operatorLabel: {
			template:
				'<div class="bl-token-attribute-group-label">' +
					'{{label}}' +
				'</div>',

			partials: {}
		}
	};

	var DEFAULTS = {
		
		attribute: {
			view: {
				comparators: [
					['=', '!='],
					['starts with', 'ends with']
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
				],
				operators: [
					{operator: '&', label: 'AND'},
					{operator: '|', label: 'OR'}
				]
			},

			getCql: function(attribute, comparator, value) {
				switch (comparator) {
					case "starts with": 
						return attribute + " = " + "\"" + value + ".*\"";
					case "ends with":
						return attribute + " = " + "\".*" + value + "\"";
					default:
						return attribute + " " + comparator + " \"" + value + "\"";
				}
			}
		},

		token: {
			view: {},
			rootOperator: { operator: '&', label: 'AND' }
		},

		attributeGroup: {
			view: {}
		}
	};

	//-------------------
	// Class Querybuilder
	//-------------------
		
	var QueryBuilder = function($rootElement, options) {
		if (!(this instanceof QueryBuilder)) {
			return new QueryBuilder($rootElement, options);
		}

		// Use extendext so arrays in the defaults are replaced instead of merged with those in options
		this.settings = $.extendext(true, 'replace', {}, DEFAULTS, options);
		this.element = $rootElement;
		this._prepareElement($rootElement);
		this.createTokenButton = $rootElement.find('.bl-token-create');
		this.createTokenButton.click();
	};
		
	QueryBuilder.prototype._prepareElement = function($element) {
		$element.addClass('bl-token-container');
		$element.data('builder', this);

		// Enable sorting tokens within the root container
        $element.sortable({
        	items: '>*:not(.bl-prevent-sort)',
        	handle: '.bl-sort-handle',
        	placeholder: 'bl-sort-placeholder-token',
        	forcePlaceholderSize: true,

        	cursor: 'move',
        	tolerance: 'pointer',
			
			start: function(e, ui ){
				ui.placeholder.height(ui.helper.outerHeight());
				ui.placeholder.width(ui.helper.outerWidth());
			}
        });

        // Add a button to add a new token
        var $createTokenButton = $(Mustache.render(templates.createTokenButton.template, {}, templates.createTokenButton.partials));
        $createTokenButton.on('click', this.createToken.bind(this));
        $createTokenButton.appendTo($element);
        
		return $element;
	};

	// create a new token and insert it in the root container
	QueryBuilder.prototype.createToken = function() {
		var token = new Token(this);

		token.element.insertBefore(this.createTokenButton);
		this.element.trigger('cql:modified');

		return token;
	};
	
	QueryBuilder.prototype.getCql = function() {
		var cqlParts = [];
		
		this.element.find('.bl-token').each(function(index, element){
			cqlParts.push($(element).data('token').getCql());
		});
		
		return cqlParts.join(" ");
	};

	//----------
	// Class Token
	//----------

	var Token = function(parentBuilder) {
		if (!(this instanceof Token)) {
			return new Token(parentBuilder);
		}

		this.builder = parentBuilder;
		this.element = this._createElement();
		this.rootAttributeGroup = this._createRootAttributeGroup();
		this.createAttribute();
	};

	Token.prototype._createElement = function() {
		var view = $.extend({}, this.builder.settings.token.view, { currentId: generateId('token') });
		var $element = $(Mustache.render(templates.token.template, view, templates.token.partials));

		this._prepareElement($element);
		
		return $element;
	};

	Token.prototype._prepareElement = function($element) {
		$element.data('token', this);
		$element.find('input').on('change', function(event) {
			$element.trigger('cql:modified');
		});
				
		$element.on('cql:modified', this._updateCql.bind(this));
	};

	Token.prototype._createRootAttributeGroup = function() {
		var rootId = '#' + this.element.attr('id');

		var group = new AttributeGroup(this.builder, this.builder.settings.token.rootOperator.operator, this.builder.settings.token.rootOperator.label);
		group.element.removeClass('well');
		group.element.appendTo(this.element.find(rootId + '_tab_attributes'));
		group.isRoot = true;

		return group;
	};

	Token.prototype._updateCql = function() {
		var rootId = '#' + this.element.attr('id');

		var $cqlPreviewElement = this.element.find(rootId + '_cql_preview');
		$cqlPreviewElement.text(this.getCql());
	};

	Token.prototype.createAttribute = function() {
		var attribute = new Attribute(this.builder);
		this.rootAttributeGroup.addAttributeOrGroup(attribute);
		return attribute;
	};

	Token.prototype.createAttributeGroup = function(operator, operatorLabel) {
		var attributeGroup = new AttributeGroup(this.builder, operator, operatorLabel);
		this.rootAttributeGroup.addAttributeOrGroup(attributeGroup);
		return attributeGroup;
	};

	Token.prototype.getCql = function() {
		var baseId ="#" + this.element.attr('id');
			
		var optional = this.element.find(baseId + "_property_optional").prop('checked');
		var minRepeats = parseInt(this.element.find(baseId + "_property_repeats_min").val());
		var maxRepeats = parseInt(this.element.find(baseId + "_property_repeats_max").val());
		var beginOfSentence = this.element.find(baseId + "_property_sentence_start").prop('checked');
		var endOfSentence = this.element.find(baseId + "_property_sentence_end").prop('checked');
		

		var outputParts = [];
		
		if (beginOfSentence) {
			outputParts.push("<s> ");
		}

		outputParts.push("[ ");
		outputParts.push(this.rootAttributeGroup.getCql());
		outputParts.push(" ]");


		if (!isNaN(minRepeats) || !isNaN(maxRepeats)) { // Only output when at least one of them is entered
			minRepeats = minRepeats || 0;			// Set some default values in case of omitted field
			maxRepeats = maxRepeats || Infinity;

			if (minRepeats < maxRepeats) {  
				if (maxRepeats != Infinity) { // infinite is empty field instead of max value
					outputParts.push("{"+minRepeats+","+maxRepeats+"}");
				} else {
					outputParts.push("{"+minRepeats+", }");
				}
			} 
			else if (minRepeats == maxRepeats && minRepeats != 1) { // 1 is the default so if min == max == 1 then we don't need to do anything
				outputParts.push("{"+minRepeats+"}");
			}
		}

		if (optional) {
			outputParts.push("?");
		}

		if (endOfSentence) {
			outputParts.push(" <s>");
		}

		return outputParts.join("");
	};

	//---------------------
	// Class AttributeGroup
	//---------------------

	var AttributeGroup = function(parentBuilder, operator, operatorLabel) {
		if (!(this instanceof AttributeGroup)) {
			return new AttributeGroup(parentBuilder, operator, operatorLabel);
		}

		this.builder = parentBuilder;
		this.operator = operator;
		this.operatorLabel = operatorLabel;
		this.element = this._createElement();
	};

	AttributeGroup.prototype._createElement = function() {
		var view = $.extend({}, this.builder.settings.attributeGroup.view, { 
			currentId: generateId('attribute_group')
		});
		
		var $element = $(Mustache.render(templates.attributeGroup.template, view, templates.attributeGroup.partials));
		
		this._prepareElement($element);
		
		return $element;
	};

	AttributeGroup.prototype._prepareElement = function($element) {
		$element.data('attributeGroup', this);
		$element.on('cql:modified', this._updateLabels.bind(this));
	};

	AttributeGroup.prototype._removeIfEmpty = function() {
		var $children = this.element.children('.bl-token-attribute, .bl-token-attribute-group');
		var parentGroup = this.element.parent().data('attributeGroup');
		var self = this;
		

		if (this.isRoot) {
			if ($children.length == 0) {
				this.element.closest('.bl-token').remove();
			}
			return;
		}

		if ($children.length <= 1) {
			
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
		this.element.children('.bl-token-attribute-group-create-token').remove();

		var self = this;
		this.element.children('.bl-token-attribute, .bl-token-attribute-group').each(function(index, element) {
			var $newLabel = $(Mustache.render(templates.operatorLabel.template, {label: self.operatorLabel}, templates.operatorLabel.partials));
			$newLabel.insertAfter(element);
		});
		this.element.children('.bl-token-attribute-group-label').last().remove();
		
		// create button
		var $createAttributeButton = $('<button type="button" class="btn btn-sm btn-default bl-token-attribute-group-create-token"><span class="glyphicon glyphicon-plus"></span></button>"');
		$createAttributeButton.on('click', function(event) {
			var $lastChild = self.element.children('.bl-token-attribute, .bl-token-attribute-group').last();
			var lastChildData = $lastChild.data('attributeGroup') || $lastChild.data('attribute');
			
			self.addAttributeOrGroup(new Attribute(self.builder), lastChildData);
			self.element.trigger('cql:modified');
		});
		
		$createAttributeButton.appendTo(this.element);
	};

	// if no preciding attribute, insertion will be at the front of this group
	AttributeGroup.prototype.addAttributeOrGroup = function(attributeOrGroup, precedingAttributeOrGroup) {
		if (precedingAttributeOrGroup && precedingAttributeOrGroup.element.parent().index(0) !== this.element.index(0)) {
			throw new Error("AttributeGroup.addAttributeOrGroup: precedingAttributeOrGroup is not a child of this group");
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

	AttributeGroup.prototype.getCql = function() {
		var cqlStrings = [];
			
		this.element.children('.bl-token-attribute, .bl-token-attribute-group').each(function(index, element) {
			var instance = $(element).data('attributeGroup') || $(element).data('attribute');
			var elemCql = instance.getCql();
			
			if (elemCql && elemCql !== "") { // Do not push null, undefined or empty strings
				cqlStrings.push(elemCql);
			}
		});

		var joinedCql = cqlStrings.join(" " + this.operator + " ");
		if (this.isRoot) {
			return joinedCql;
		} else {
			return "(" + joinedCql  + ")";
		}
	};

	//----------------
	// Class Attribute
	//----------------

	var Attribute = function(parentBuilder) {
		if (!(this instanceof Attribute)) {
			return new Attribute(parentBuilder);
		}

		this.builder = parentBuilder;
		this.element = this._createElement();
	};

	Attribute.prototype._createElement = function(){
		var view = $.extend({}, this.builder.settings.attribute.view, { currentId: generateId('attribute') });
		var $element = $(Mustache.render(templates.attribute.template, view, templates.attribute.partials));

		this._prepareElement($element);
		
		return $element;
	};

	Attribute.prototype._prepareElement = function($element) {
		var baseId = "#" + $element.attr('id');
		
		$element.data('attribute', this);

		$element.find('.selectpicker').selectpicker();
		$element.find('.selectpicker, input').on('change', function(event) {$element.trigger('cql:modified');});

		var self = this;
		$element.find("[data-bl-token-attribute-group-operator]").on('click', function(event) {
			var parentGroup = self.element.parent().data('attributeGroup');
			var requestedOperator = $(event.currentTarget).data('bl-token-attribute-group-operator');
			var requestedLabel = $(event.currentTarget).data('bl-token-attribute-group-operator-label');

			if (parentGroup.operator != requestedOperator) {
				var newGroup = new AttributeGroup(self.builder, requestedOperator, requestedLabel);
				parentGroup.addAttributeOrGroup(newGroup, self);
				newGroup.addAttributeOrGroup(self);
				newGroup.addAttributeOrGroup(new Attribute(self.builder), self);
				//parentGroup.element.trigger('cql:modified');
			} else {
				parentGroup.addAttributeOrGroup(new Attribute(self.builder), self);
				//parentGroup.element.trigger('cql:modified');
			}
		});
		
		
		// Show/hide elements for the selected attribute type
		// Such as case-sensitivity checkbox or comboboxes for when there is a predefined set of valid values
		$element.find(baseId + '_type').on('loaded.bs.select changed.bs.select', function(e) { 
			var selectedValue = $(this).val();
			self._updateShownOptions(selectedValue); 
		});
		
		$element.find(baseId + '_delete').on('click', function() {
			var parentGroup = self.element.parent().data('attributeGroup');
			self.element.detach();
			//parentGroup._updateLabels();
			parentGroup._removeIfEmpty();
			parentGroup.element.trigger('cql:modified');
		});
	};
	
	Attribute.prototype._updateShownOptions = function(selectedValue) {
		var search = '[data-attribute-type]';
		
		this.element.find(search).hide().filter('[data-attribute-type="' + selectedValue + '"]').show();
	};

	Attribute.prototype.getCql = function() {
		var rootId = '#' + this.element.attr('id');

		var type 		= this.element.find(rootId + '_type').val();
		var operator 	= this.element.find(rootId + '_operator').val();
		var value 		= this.element.find(rootId + '_value').val();
		
		
		var $optionsContainer = this.element.find('[data-attribute-type="' + type + '"]');
		
		// Apply modifiers such as case-sensitivity
		var caseSensitive = $optionsContainer.find('[data-attribute-role="case"]').is(":checked") || false;
		if (caseSensitive)
			value = "(?-i)" + value;
		
		var callback = this.builder.settings.attribute.getCql;
		if (typeof callback === "function") {
			return callback(type, operator, value);
		} else {
			return type + " " + operator + " " + "\"" + value + "\"";
		}
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
	
	//---------------
	// non-object api
	//---------------
	
	return {
		createQueryBuilder: function($rootElement, options) {
			return new QueryBuilder($rootElement, options);
		}
	};

})();