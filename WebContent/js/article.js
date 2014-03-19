$(document).ready(function () {
	$('span.word').tooltip();
	initialiseAnchors();
});

var anchors = [];
var position = 0;

function initialiseAnchors() {
	$(".anchor").each(function(index) {
		anchors.push($(this).attr("name"));
	});
	
	if(anchors.length == 0)
		$(".hitscroll").hide();
}

function getNextAnchorName() {
	position++;
	
	if(position >= anchors.length)
		position = 0;
	
	return anchors[position];
}

function getPreviousAnchorName() {
	position--;
	
	if(position < 0)
		position = anchors.length - 1;
	
	return anchors[position];
}

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