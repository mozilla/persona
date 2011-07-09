steal(function( steal ) {

	/**
	 * Builds and compresses CSS files.
	 * @param {Object} opener
	 * @param {Object} options
	 */
	var styles = (steal.build.builders.styles = function( opener, options ) {
		steal.print("\nBUILDING STYLES --------------- ");
		//where we are putting stuff
		var folder = options.to.substr(0, options.to.length - 1),
			//where the page is
			pageFolder = steal.File(opener.url).dir(),
			currentPackage = [];

		opener.each('link', function( link, text, i ) {
			steal.print(link.type)
			//let people know we are adding it
			if ( link.href && steal.build.types[link.type] ) {
				steal.print(link.href)

				var loc = steal.File(pageFolder).join(link.href),
					converted = convert(text, loc, folder)


					currentPackage.push(steal.cssMin(converted))

			}

		});
		steal.print("")
		if ( currentPackage.length ) {
			steal.print("STYLE BUNDLE > " + folder + "/production.css\n")
			steal.File(folder + "/production.css").save(currentPackage.join('\n'));
		} else {
			steal.print("no styles\n")
		}



	});
	//used to convert css referencs in one file so they will make sense from prodLocation
	var convert = function( css, cssLocation, prodLocation ) {
		//how do we go from prod to css
		var cssLoc = new steal.File(cssLocation).dir(),
			newCSss = css.replace(/url\(['"]?([^'"\)]*)['"]?\)/g, function( whole, part ) {

				//check if url is relative
				if (!isRelative(part) ) {
					return whole
				}

				//it's a relative path from cssLocation, need to convert to
				// prodLocation
				var imagePath = steal.File(part).joinFrom(cssLoc),
					fin = steal.File(imagePath).toReferenceFromSameDomain(prodLocation);
				//print("  -> "+imagePath);
				steal.print("  " + part + " > " + fin);
				return "url(" + fin + ")";
			});
		return newCSss;
	},
		isRelative = function( part ) {
			// http://, https://, / 
			return !/^(http:\/\/|https:\/\/|\/)/.test(part)
		}

		var comments = /\/\*.*?\*\//g,
		newLines = /\n*/g,
		space = /[ ]+/g,
		spaceChars = /\s?([;:{},+>])\s?/g,
		lastSemi = /;}/g;


	steal.cssMin = function( css ) {
		//remove comments
		return css.replace(comments, "")
			.replace(newLines, "")
			.replace(space, " ")
			.replace(spaceChars, '$1')
			.replace(lastSemi, '}')
	}

});