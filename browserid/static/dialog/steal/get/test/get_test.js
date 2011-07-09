load('steal/rhino/steal.js')
load('steal/rhino/test.js');

steal('//steal/get/get',function(rhinoSteal){
	_S = steal.test;
	

	
	_S.module("steal/get")
	STEALPRINT = false;
	
	_S.test("root repo" , function(t){
		
		rhinoSteal.get('ss/router',{});
		
		var license = readFile("ss/router/LICENSE");
		
		t.ok(license, "srchr downloaded");
		rhinoSteal.File("ss").removeDir();
	});
	
	_S.test("deep repo" , function(t){		
		rhinoSteal.get('srchr',{});
		
		var srchr = readFile("srchr/srchr.html");
		
		t.ok(srchr, "srchr downloaded");
		rhinoSteal.File("srchr").removeDir();
	});
	
	
});

