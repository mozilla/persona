/**
@page example 2.2. Test Examples 
@parent FuncUnit

## Srchr Smoke Test

This guide will walk through creating a smoke test for the [http://javascriptmvc.com/srchr/srchr.html Srchr application].  
Srchr is a simple demo application that lets you search several sources for images.  There is a search pane, 
tabs, a history pane, and a results area.

@image jmvc/images/srchr.png

The purpose of a smoke test is to test enough functionality in an application to verify its working correctly, as 
quickly as possible.

In this smoke test we'll:

1. click the Flickr search option
1. type "puppy" in the search box
1. wait for results to show up in the results panel
1. verify 10 results are visible
1. verify the history panel shows "puppy"

Let's start by creating a skeleton test with some pseudocode:

@codestart
module("Srchr",{
	setup: function() {
		S.open("//srchr/srchr.html");
	}
})

test("Smoke Test", function(){
	// click search options
	// type puppy
	// wait for results
	// verify 10 results
	// verify history has puppy
})
@codeend

Now lets start to fill in these commands, leaving the actual selectors for last.

@codestart
flickrInput.click();
// \r means hit enter, which submits the form
searchInput.click().type("puppy\r");
resultElements.visible(function(){
	equals(resultsElements.size(), 10, "There are 10 results");
	ok(/puppy/.test( historyEl.text() ), "History has puppy");
})
@codeend

In this test, we're performing the search, waiting for results to appear, then asserting conditions of our page. 
Here's the test with selectors filled in:

@codestart
 S('#cb_flickr').click();
 S('#query').click().type('puppy\r');
 
 S('#flickr li').visible(function(){
      equals(S('#flickr li').size(), 10, 'There are 10 results')
      ok( /puppy/.test( S('#history .text').text() ), 'History has puppy')
 })
@codeend

That's it.  Writing a working test is easy!

*/