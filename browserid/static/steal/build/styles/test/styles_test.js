// load('steal/compress/test/run.js')
/**
 * Tests compressing a very basic page and one that is using steal
 */
load('steal/rhino/steal.js')
steal('//steal/test/test', function( s ) {
	//STEALPRINT = false;
	s.test.module("steal/build/styles")
	
	STEALPRINT = false;

	s.test.test("css", function(){
		load('steal/rhino/steal.js');
		steal.plugins(
			'steal/build',
			'steal/build/scripts',
			'steal/build/styles',
			function(){
				steal.build('steal/build/styles/test/page.html',
					{to: 'steal/build/styles/test'});
			});
		
		var prod = readFile('steal/build/styles/test/production.css').replace(/\r|\n|\s/g,""),
			expected = readFile('steal/build/styles/test/productionCompare.css').replace(/\r|\n|\s/g,"");
		
		s.test.equals(
			prod,
			expected,
			"css out right");
			
		s.test.clear();
	})

});