function scrollToResults() {
	$('html, body').animate({scrollTop: $("#results").offset().top - 70}, 300);
}

function addMultiSelectExpanders() {
	var smallHeight = $(".multiselect").height();
	var bigHeight = smallHeight * 4;
	
	$(".multiselect").focusout(function () {
		var element = $(this);
		
		setTimeout(function() {
			element.height(smallHeight);
		}, 150);
	});
	
	// consume mousedown event to avoid accidental
	// selection changes when focusing on collapsed
	// multiselect input boxes
	$(".multiselect").mousedown(function (event) {		
		if($(this).height() < bigHeight - 1) { // minus one to correct for element decimal differences
			// set small/big height again to adjust for page zoom changes
			smallHeight = $(this).height();
			bigHeight = smallHeight * 4;
			
			$(this).height(bigHeight);
			event.stopPropagation();
			event.preventDefault();
			$(this).focus();
		}
	});
}

function addFilterOverview() {
	$(".forminput").change(function () {
		var element = $(this);
		
		addToList(element);
		
		updateFilterOverview();
	});
	
	// for each input item that already has items selected
	$(".forminput").each(function(index){
		var element = $(this);
		
		addToList(element);
	});
	
	updateFilterOverview();
}

function addToList(element) {	
	removeFromFilterList(getElementName(element));
	
	if(element.val() != '' && element.val() != null) {
		var filter = {filter: getElementName(element), values: element.val()};
	
		ar_ActiveFilters.push(filter);
	}
}

function getElementName(element) {
	var tab = element.closest(".tab-pane").attr("id");
	
	if(tab)
		tab = tab + "-";
	else
		tab = "";
	
	return  tab + element.attr("placeholder");
}

function updateFilterOverview() {
	var overview = "";
	for(var i = 0; i < ar_ActiveFilters.length; i++) 
		overview = overview + ar_ActiveFilters[i].filter + ": <i>" + ar_ActiveFilters[i].values + "</i>, ";
	
	$("#filteroverview").html("<small>" + overview + "</small>");
}

function removeFromFilterList(filter) {
	var newArray = [];
	for(var i = 0; i < ar_ActiveFilters.length; i++) {
		if(ar_ActiveFilters[i].filter != filter)
			newArray.push(ar_ActiveFilters[i]);
	}
	
	ar_ActiveFilters = newArray;
}

var ar_ActiveFilters = [];