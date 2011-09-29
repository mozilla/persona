steal('jquery').then(function(){

(function($){
	var getWindow = function( element ) {
		return element.ownerDocument.defaultView || element.ownerDocument.parentWindow
	}

/**
 * Returns a unique selector for the matched element.
 * @param {Object} target
 */
$.fn.prettySelector= function() {
	var target = this[0];
	if(!target){
		return null
	}
	var selector = target.nodeName.toLowerCase();
	//always try to get an id
	if(target.id){
		return "#"+target.id;
	}else{
		var parent = target.parentNode;
		while(parent){
			if(parent.id){
				selector = "#"+parent.id+" "+selector;
				break;
			}else{
				parent = parent.parentNode
			}
		}
	}
	if(target.className){
		selector += "."+target.className.split(" ")[0]
	}
	var others = $(selector, getWindow(target).document); //jquery should take care of the #foo if there
	
	if(others.length > 1){
		return selector+":eq("+others.index(target)+")";
	}else{
		return selector;
	}
};
$.each(["closest","find","next","prev","siblings","last","first"], function(i, name){
	$.fn[name+"Selector"] = function(selector){
		return this[name](selector).prettySelector();
	}
});





}(window.jQuery  || window.FuncUnit.jQuery));


})