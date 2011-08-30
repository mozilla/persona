steal('auto_suggest',function(){
	
	var data1 = [
		{value: "21", name: "JavaScriptMVC"},
		{value: "43", name: "Jupiter JavaScript Consulting"},
		{value: "46", name: "Jupiter JavaScript Training"},
		{value: "54", name: "Jupiter JavaScript Development"},
		{value: "55", name: "FuncUnit JavaScript Testing"},
		{value: "79", name: "Michael Jordan"}
	],
	data2 = ["JavaScriptMVC","Jupiter JavaScript Consulting",
			"Jupiter JavaScript Training","Jupiter JavaScript Development",
			"FuncUnit JavaScript Testing","Michael Jordan"];
	
	//$("#auto").autoSuggest(data, {selectedItemProp: "name", searchObjProps: "name"})
	AutoComplete_Create("auto",data2)
})