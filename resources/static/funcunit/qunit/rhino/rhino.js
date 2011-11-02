// This maps qUnit's functions to report to FuncUnit ...
steal.then(function(){
	if (navigator.userAgent.match(/Rhino/) && !window.build_in_progress) {
		//map QUnit messages to FuncUnit
		['log',
			'testStart',
			'testDone',
			'moduleStart',
			'moduleDone',
			'done'].forEach(function(item){
				QUnit[item] = function(){
					FuncUnit[item].apply(FuncUnit, arguments);
				};
				
			})

	}
})