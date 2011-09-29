// This code is always run ...

steal.then(function(){
	if (typeof FuncUnit == 'undefined') {
		FuncUnit = {};
	}
	// these are the 
	steal.extend(FuncUnit,{
		testStart: function(name){
			print("--" + name + "--")
		},
		log: function(result, message){
			if (!message) 
				message = ""
			print((result ? "  PASS " : "  FAIL ") + message)
		},
		testDone: function(name, failures, total){
			print("  done - fail " + failures + ", pass " + total + "\n")
		},
		moduleStart: function(name){
			print("MODULE " + name + "\n")
		},
		moduleDone: function(name, failures, total){
		
		},
		browserStart : function(name){
			print("BROWSER " + name + " ===== \n")
		},
		browserDone : function(name, failures, total){
			print("\n"+name+" DONE " + failures + ", " + total + (FuncUnit.showTimestamps? (' - ' 
						+ formattedtime + ' seconds'): ""))
		},
		done: function(failures, total){
			print("\nALL DONEe - fail " + failures + ", pass " + total)
		}
	});
	/**
	 * Loads the FuncUnit page in EnvJS.  This loads FuncUnit, but we probably want settings 
	 * on it already ....
	 * 
	 * 2 ways to include settings.js:
	 * 1. Manually before funcunit.js 
	 * 2. FuncUnit.load will try to load settings.js if there hasn't been one loaded
	 */ 
	FuncUnit.load = function(page){
		//clear out steal ... you are done with it...
		var extend = steal.extend;
		steal = undefined;
		load('steal/rhino/env.js');
		if (!navigator.userAgent.match(/Rhino/)){
			return;
		} 
		
		var dirArr = page.split("/"), 
			dir = dirArr.slice(0, dirArr.length - 1).join("/"), 
			settingsPath = dir + "/settings.js";
			
		// if settings.js was already loaded, don't try to load it again
		if (FuncUnit.browsers === undefined) {
			//this gets the global object, even in rhino
			var window = (function(){return this}).call(null), 
				backupFunc = window.FuncUnit;
			
			if(readFile('funcunit/settings.js')){
				load('funcunit/settings.js')
			}
			
			// try to load a local settings
			var foundSettings = false;
			if(/^http/.test(settingsPath)){
				try {
					readUrl(settingsPath)
					foundSettings = true;
				} 
				catch (e) {}
			}else{
				if(readFile(settingsPath)){
					foundSettings = true;
				}

			}
			
			if (foundSettings) {
				print("Reading Settings From "+settingsPath)
				load(settingsPath)
			}else{
				print("Using Default Settings")
			}
			
			extend(FuncUnit, backupFunc)
			
			
		}
		
		Envjs(page, {
			scriptTypes: {
				"text/javascript": true,
				"text/envjs": true,
				"": true
			},
			fireLoad: true,
			logLevel: 2,
			dontPrintUserAgent: true,
			exitOnError : FuncUnit.exitOnError
		});
	}
})