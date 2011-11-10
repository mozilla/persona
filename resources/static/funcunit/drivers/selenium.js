steal.then(function(){
	
	// TODO: we should not do this if documenting ...
	if (navigator.userAgent.match(/Rhino/) && !window.DocumentJS && !(steal && steal.pluginify)) {

		// configuration defaults
		FuncUnit.serverHost = FuncUnit.serverHost || "localhost";
		FuncUnit.serverPort = FuncUnit.serverPort || 4444;
		if(!FuncUnit.browsers){
			if(FuncUnit.jmvcRoot)
				// run all browsers if you supply a jmvcRoot
				// this is because a jmvcRoot means you're not running from filesystem, 
				// so safari and chrome will work correctly 
				FuncUnit.browsers = ["*firefox", "*iexplore", "*safari", "*googlechrome"]
			else {
				FuncUnit.browsers = ["*firefox"]
				if(java.lang.System.getProperty("os.name").indexOf("Windows") != -1){
					FuncUnit.browsers.push("*iexplore")
				}
			}
		}
		
		FuncUnit.startSelenium();
		(function(){
			var browser = 0,
				fails = 0,
				totals = 0;
			//convert spaces to %20.
			var location = /file:/.test(window.location.protocol) ? window.location.href.replace(/ /g,"%20") : window.location.href;
			
			
			// overwrite QUnit.done to do the 'restarting' ....
			QUnit.done = function(failures, total){
				FuncUnit.selenium.close();
				FuncUnit.selenium.stop();
				FuncUnit.endtime = new Date().getTime();
				var formattedtime = (FuncUnit.endtime - FuncUnit.starttime) / 1000;
				
				FuncUnit.browserDone(FuncUnit.browsers[browser], failures, total);
				fails +=  failures;
				totals += total;
				
				
				browser++;
				if (browser < FuncUnit.browsers.length) {
					FuncUnit.browserStart(  FuncUnit.browsers[browser] );
					
					
					FuncUnit.selenium = new DefaultSelenium(FuncUnit.serverHost, 
						FuncUnit.serverPort, FuncUnit.browsers[browser], location);
					FuncUnit.starttime = new Date().getTime();
					FuncUnit.selenium.start();
					QUnit.restart();
				} else {
					// Exit ...
					if (java.lang.System.getProperty("os.name").indexOf("Windows") != -1) {
						runCommand("cmd", "/C", 'taskkill /fi "Windowtitle eq selenium" > NUL')
						//quit()
					}
					FuncUnit.done(fails, totals);
					//
				}
			}
			FuncUnit.browserStart(FuncUnit.browsers[0]);
			
			FuncUnit.selenium = new DefaultSelenium(FuncUnit.serverHost, 
				FuncUnit.serverPort, 
				FuncUnit.browsers[0], 
				location);
				
			FuncUnit.starttime = new Date().getTime();
			FuncUnit.selenium.start();
			
			
			FuncUnit._open = function(url){
				this.selenium.open(url);
			};
			var confirms = [], prompts = [];
			FuncUnit.confirm = function(answer){
				confirms.push(!!answer)
				print(FuncUnit.jquery.toJSON(confirms))
				FuncUnit.selenium.getEval("_win().confirm = function(){var confirms = "+FuncUnit.jquery.toJSON(confirms)+
					";return confirms.shift();};");
			}
			FuncUnit.prompt = function(answer){
				prompts.push(answer)
				FuncUnit.selenium.getEval("_win().prompt = function(){var prompts = "+FuncUnit.jquery.toJSON(prompts)+
					";return prompts.shift();};");
			}
			FuncUnit._onload = function(success, error){
				setTimeout(function(){
					FuncUnit.selenium.getEval("selenium.browserbot.getCurrentWindow().focus();selenium.browserbot.getCurrentWindow().document.documentElement.tabIndex = 0;");
					FuncUnit.selenium.getEval("_win().alert = function(){};");
					success();
				}, 1000)
			};
			var convertToJson = function(arg){
				return arg === FuncUnit.window ? "selenium.browserbot.getCurrentWindow()" : FuncUnit.jquery.toJSON(arg)
				
			}
			FuncUnit.$ = function(selector, context, method){
				var args = FuncUnit.makeArray(arguments);
				var callbackPresent = false;
				for (var a = 0; a < args.length; a++) {
					if (a == 1) { //context
						if (args[a] == FuncUnit.window.document) {
							args[a] = "_doc()"
						}
						else {
							if (typeof args[a] == "number") {
								args[a] = "_win()[" + args[a] + "].document"
							}
							else 
								if (typeof args[a] == "string") {
									args[a] = "_win()['" + args[a] + "'].document"
								}
						}
					}
					else {
						if (args[a] == FuncUnit.window.document) {
							args[a] = "_doc()"
						}
						else if (args[a] == FuncUnit.window) {
							args[a] = "_win()"
						}
						else if (typeof args[a] == "function") {
							callbackPresent = true;
							var callback = args[a];
							args[a] = "Selenium.resume";
						}
						else 
							args[a] = convertToJson(args[a]);
					}
				}
				var response = FuncUnit.selenium.getEval("jQuery.wrapped(" + args.join(',') + ")");
				if(callbackPresent){
					return callback( eval("(" + response + ")") )
				} else {
					return eval("(" + response + ")")//  q[method].apply(q, args);
				}
			}
			/**
			 * var val = S.eval("$(\".contacts\").controller().val()");
			 * Appends "window." to the front of the string, so currently this method only works with one liners
			 * @param {Object} str
			 */
			FuncUnit.eval = function(str){
				return FuncUnit.selenium.getEval("selenium.browserbot.getCurrentWindow()."+str)
			}
			
			
			
		})();
	}
});