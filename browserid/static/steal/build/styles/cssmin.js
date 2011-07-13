steal(function( steal ) {
	var comments = /\/\*.*?\*\//g,
		newLines = /\n*/g,
		space = /[ ]+/g,
		spaceChars = /\s?([;:{},+>])\s?/g,
		lastSemi = /;}/g;


	steal.cssMin = function( css ) {
		//remove comments
		return css.replace(comments, "").replace(newLines, "").replace(space, " ").replace(spaceChars, '$1').replace(lastSemi, '}')
	}
})