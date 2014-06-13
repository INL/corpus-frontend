// Article-related functions.
// Takes care of tooltips and highlighting/scrolling to anchors.

$(document).ready(function () {

    // Create jQuery Tooltips from title attributes
	$('span.word').tooltip();
	
	// Find all anchor names
	initialiseAnchors();
});

// Names of anchors (elements with class anchor)
var anchors = [];

// Current anchor
var position = 0;

// Find all anchor names
function initialiseAnchors() {
	$(".anchor").each(function(index) {
		anchors.push($(this).attr("name"));
	});
	
	if(anchors.length == 0)
		$(".hitscroll").hide();
}

// Go to next anchor and return name
function getNextAnchorName() {
	position++;
	
	if(position >= anchors.length)
		position = 0;
	
	return anchors[position];
}

// Go to previous anchor and return name
function getPreviousAnchorName() {
	position--;
	
	if(position < 0)
		position = anchors.length - 1;
	
	return anchors[position];
}

// Highlight and scroll to previous anchor
function gotoPreviousAnchor() {
	var oldname = window.location.hash;
	oldname = oldname.replace("#", "");
	window.location.hash = "";
	var myname = getPreviousAnchorName();
	window.location.hash = myname; 
	window.scrollBy(0,-150);
	
	$('a[name=' + oldname + ']').removeClass('activeLink');
	$('a[name=' + myname + ']').addClass('activeLink');
}

// Highlight and scroll to next anchor
function gotoNextAnchor() {
	var oldname = window.location.hash;
	oldname = oldname.replace("#", "");
	window.location.hash = "";
	var myname = getNextAnchorName();
	window.location.hash = myname; 
	window.scrollBy(0,-150);
	
	$('a[name=' + oldname + ']').removeClass('activeLink');
	$('a[name=' + myname + ']').addClass('activeLink');
}
