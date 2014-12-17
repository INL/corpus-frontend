// Article-related functions.
// Takes care of tooltips and highlighting/scrolling to anchors.

$(document).ready(function () {

    // Create jQuery Tooltips from title attributes
	$('span.word').tooltip();
	
	// Show number of hits at the top of the metadata
	var numHits = $('a.hl').length;
	$('#divHitsInDocument').text(numHits); 
});


// For navigating through search hits within the article
//--------------------------------------------------------------------
var ANCHORS = {};

(function () {
	
	// To enable support for HTML5-History-API polyfill in your library
	var location = window.history.location || window.location;
	
	// Names of anchors (elements with class anchor)
	var anchors = [];

	// Current anchor
	var position = 0;

	// Find all anchor names
	$(document).ready(function () {
		$(".anchor").each(function(index) {
			anchors.push($(this).attr("name"));
		});
		
		if(anchors.length == 0)
			$(".hitscroll").hide();
	});

	// Highlight and scroll to previous anchor
	ANCHORS.gotoPrevious = function () {
		
		// Go to previous anchor and return name
		function getPreviousAnchorName() {
			position--;
			
			if(position < 0)
				position = anchors.length - 1;
			
			return anchors[position];
		}
		
		var oldname = location.hash;
		oldname = oldname.replace("#", "");
		location.hash = "";
		var myname = getPreviousAnchorName();
		location.hash = myname; 
		window.scrollBy(0,-150);
		
		if (oldname && oldname.length > 0)
			$('a[name=' + oldname + ']').removeClass('activeLink');
		$('a[name=' + myname + ']').addClass('activeLink');
		
		return false; // don't follow link
	};

	// Highlight and scroll to next anchor
	ANCHORS.gotoNext = function () {
		
		// Go to next anchor and return name
		function getNextAnchorName() {
			position++;
			
			if(position >= anchors.length)
				position = 0;
			
			return anchors[position];
		}

		var oldname = location.hash;
		oldname = oldname.replace("#", "");
		location.hash = "";
		var myname = getNextAnchorName();
		location.hash = myname; 
		window.scrollBy(0,-150);
		
		if (oldname && oldname.length > 0)
			$('a[name=' + oldname + ']').removeClass('activeLink');
		$('a[name=' + myname + ']').addClass('activeLink');
		
		return false; // don't follow link
	};
	
})();
