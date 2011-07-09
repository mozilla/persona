module("dialog test", { 
	setup: function(){
		S.open("///web/browserid/browserid/static/dialog/dialog/dialog.html");
	}
});

test("Copy Test", function(){
	equals(S("h1").text(), "Welcome to JavaScriptMVC 3.0!","welcome text");
});