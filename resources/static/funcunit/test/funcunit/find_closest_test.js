module("funcunit - find / closest",{
	setup: function() {
		var self = this;
		S.open("//funcunit/test/findclosest.html", function(){
			self.pageIsLoaded = true;
		}, 10000)
	}
});

test("closest", function(){
	S(":contains('Holler')").closest("#foo").click(function(){
		ok(this.hasClass("iWasClicked"),"we clicked #foo")
	})
	S(":contains('Holler')").closest(".baz").click(function(){
		ok(S(".baz").hasClass("iWasClicked"),"we clicked .baz")
	})
	
})

test("find", function(){
	S(":contains('Holler')")
		.closest("#foo")
		.find(".combo")
		.click(function(){
			ok(S(".combo:eq(0)").hasClass("iWasClicked"),"we clicked the first combo")
			ok(!S(".combo:eq(1)").hasClass("iWasClicked"),"we did not click the 2nd combo")
		})
})
