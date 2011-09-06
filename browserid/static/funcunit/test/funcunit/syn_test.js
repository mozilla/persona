module("funcunit-syn integration")


test("Type and slow Click", function(){
	S.open("//funcunit/test/myapp.html", null, 10000);
	
	S("#typehere").type("javascriptmvc", function(){
		equals(S("#seewhatyoutyped").text(), "typed javascriptmvc","typing");
	})
	

	
	//click is going to run slow, to make sure we don't continue
	//until after it is done.
	S("#copy").click(function(){
		equals(S("#seewhatyoutyped").text(), "copied javascriptmvc","copy");
	});
	

	//S("#typehere").offset(function(offset){
	//	ok(offset.top,"has values")
	//})
})

test("Move To", function(){
	S.open("//funcunit/test/drag.html", null, 10000);
	S("#start").move("#end")
	S("#typer").type("javascriptmvc",function(){
		equals(S("#typer").val(), "javascriptmvc","move test worked correctly");
	})

})

test("Drag To", function(){
	S.open("//funcunit/test/drag.html", null, 10000);
	S("#drag").drag("#drop")
	S("#clicker").click(function(){
		equals(S(".status").text(), "dragged", 'drag worked correctly')
	})

})