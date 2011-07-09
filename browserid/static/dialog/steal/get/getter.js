/*  This is a port to JavaScript of Rail's plugin functionality.  It uses the following
 * license:
 *  This is Free Software, copyright 2005 by Ryan Tomayko (rtomayko@gmail.com) 
     and is licensed MIT: (http://www.opensource.org/licenses/mit-license.php)
 */

steal(function( steal ) {


	steal.get.getter = function( url, where, options, level ) {
		if ( url ) {
			this.init.apply(this, arguments);
		}
	};
	
	steal.get.getter.dependenciesUrl = function( url ) {
		var depUrl = url + 
			(url.lastIndexOf("/") === url.length - 1 ? "" : "/") + "dependencies.json";
		return depUrl;
	};
	
	steal.get.getter.prototype = {
		init: function( url, where, options, level ) {

			this.url = url + (/\/$/.test(url) ? "" : "/");
			this.level = level || -1;
			this.cwd = where || ".";
			this.quite = options.quite;
			this.ignore = 
				(options.ignore && 
					(steal.isArray(options.ignore) ? 
						options.ignore : 
						[options.ignore] )) 
				|| [];
			this.ignore.push(/\.jar$/);
		},
		ls: function() {
			var links = [],
				rhf = this;


			if ( this.url.match(/^svn:\/\/.*/) ) {
				steal.print('not supported');
			} else {
				links.concat(rhf.links("", readUrl(this.url)));
			}


			return links;
			//store and return flatten
		},
		//gets the links from a page
		links: function( base_url, contents ) {
			var links = [],
				anchors = contents.match(/href\s*=\s*\"*[^\">]*/ig),
				ignore = this.ignore;

			anchors.forEach(function( link ) {
				link = link.replace(/href="/i, "");

				if (!/svnindex.xsl$/.test(link) && !/^(\w*:|)\/\//.test(link) && !/^\./.test(link) ) {
					links.push((new steal.File(base_url)).join(link));
				}

			});

			return links;
		},
		//pushes a directory to go into and check
		push_d: function( dir ) {
			this.cwd = (new steal.File(this.cwd)).join(dir);
			new steal.File(this.cwd).mkdir();
		},
		//pops up to the parent directory
		pop_d: function() {
			this.cwd = new steal.File(this.cwd).dir();
		},
		//downloads content from a url
		download: function( link ) {
			
			//var text = readUrl( link);
			var bn = new steal.File(link).basename(),
				f = new steal.File(this.cwd).join(bn),
				oldsrc, newsrc, p = "   ";

			for ( var i = 0; i < this.ignore.length; i++ ) {
				if ( f.match(this.ignore[i]) ) {
					steal.print("   I " + f);
					return;
				}
			}

			oldsrc = readFile(f);
			
			new steal.File(f).download_from(link, true);
			
			
			newsrc = readFile(f);

			if ( oldsrc ) {
				if ( oldsrc == newsrc ) {
					return;
				}
				steal.print(p + "U " + f);
			} else {
				steal.print(p + "A " + f);
			}
		},
		//gets the url or the directory
		fetch: function( links ) {
			var auto_fetch = !links;
			links = links || [this.url];
			var rhf = this;
			links.forEach(function( link ) {
				//steal.print("FETCH  "+link+"\n")
				link.match(/\/$/) || auto_fetch ? rhf.fetch_dir(link) : rhf.download(link);
			});
		},
		//gets a directory
		fetch_dir: function( url ) {
			this.level++;
			if ( this.level > 0 ){
				this.push_d(new steal.File(url).basename());
			}

			var contents = readUrl(url);
			this.fetch(this.links(url, contents));
			
			if ( this.level > 0 ){
				this.pop_d();
			}
			
			this.level--;
		}
	};
});