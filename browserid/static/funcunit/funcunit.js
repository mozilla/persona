//what we need from javascriptmvc or other places
steal.plugins('funcunit/qunit',
	'funcunit/qunit/rhino')
	.then('resources/jquery','resources/json','resources/selector')
	.plugins('funcunit/syn')
//Now describe FuncUnit
.then(function(){



//this gets the global object, even in rhino
var window = (function(){return this }).call(null),

//if there is an old FuncUnit, use that for settings
	oldFunc = window.FuncUnit;

/**
 * @class FuncUnit
 * @tag core
 * @test test.html
 * @download http://github.com/downloads/jupiterjs/funcunit/funcunit-beta-5.zip

FuncUnit is a powerful functional testing framework written in JavaScript with a jQuery-like syntax.  It provides an 
approachable way to write maintainable cross browser tests.  It is the first functional testing framework written 
for JavaScript developers by JavaScript developers.

FuncUnit extends [http://docs.jquery.com/QUnit QUnit]'s API with commands like [FuncUnit.prototype.click click], [FuncUnit.prototype.type type], 
and [FuncUnit.prototype.drag drag].  The same tests can be run in browser or automated via Selenium.

## Example:
The following tests that an AutoSuggest returns 5 results.  
<a href='funcunit/autosuggest/funcunit.html'>See it in action!</a> (Make sure you turn off your popup blocker!)
@codestart
module("autosuggest",{
  setup: function() {
    S.open('autosuggest.html')
  }
});

test("JavaScript results",function(){
  S('input').click().type("JavaScript")

  // wait until we have some results
  S('.autocomplete_item').visible(function(){
    equal( S('.autocomplete_item').size(), 5, "there are 5 results")
  })
});
@codeend

## Using FuncUnit

FuncUnit works by loading QUnit, FuncUnit, and your tests into a web page.  Your application is opened in a 
separate browser window.  The FuncUnit page then drives your application via clicks, types, and drags, reporting 
pass/fail in the initial FuncUnit test page.

### Loading a Test

To get started with a basic test, run:

@codestart
./js jquery/generate/controller Company.Widget
@codeend

Open company/widget/funcunit.html in a browser.  You should see a passing test.

The first thing any FuncUnit page does is load its dependencies and a test.  A FuncUnit page:

1. Loads steal.js
2. Loads funcunit and qunit via steal.plugins
3. Loads one or more test files

For more details on setting up a FuncUnit test, check out the [FuncUnit.setup Getting Set Up] guide.  
For more details on using FuncUnit without Steal or JavaScriptMVC, check out the [FuncUnit.standalone Using Standalone FuncUnit] guide.

### Writing a Test

There are four types of commands in any FuncUnit tests:

1. Actions - simulate a user interaction ([FuncUnit.prototype.click clicks], [FuncUnit.prototype.type types], [FuncUnit.prototype.drag drags], etc)
2. Waits - wait for conditions in the page before continuing the test ([FuncUnit.prototype.width width], [FuncUnit.prototype.visible visible],  
[FuncUnit.prototype.text text], etc)
3. Getters - get page conditions to use in assertions ([FuncUnit.prototype.width width], [FuncUnit.prototype.hasClass hasClass], [FuncUnit.prototype.text text])
4. QUnit commands - assertions and methods for setting up tests (module, test, ok, equals, etc)

Tests follow a consistent pattern:

0. Each test sets itself up in QUnit's [http://docs.jquery.com/QUnit/module setup] method by opening an application page with S.open.
1. Tests simulate a user action, like clicking a link.
2. Then they wait for some page condition to change, like a menu appearing.
3*. Then you assert something about your page, like the right number of links are visible.

* This step isn't always necessary.  You can write an entire test without assertions.  If the wait condition fails, the test will fail.

For more information on writing tests, check out the [FuncUnit.writing Writing Tests] guide.

## Running a Test

To run this test in browser, open funcunit.html in any browser (and turn off your popup blocker!).

To run the same test automated via Selenium, run:

@codestart
./funcunit/envjs path/to/funcunit.html
@codeend

For more information about using Selenium, checkout the [FuncUnit.selenium Automated FuncUnit] guide.

* Use envjs.bat for Windows users.

## What is FuncUnit

Under the hood, FuncUnit is built on several projects:

 - [http://seleniumhq.org/ Selenium] - used to open browsers and run automated tests
 - [http://docs.jquery.com/Qunit QUnit] - Unit testing framework provides test running, assertions, and reporting
 - [http://jquery.com/ jQuery] - used to look up elements, trigger events, and query for page conditions
 - [http://www.envjs.com Env.js] - Rhino based headless browser used to load pages in the command line
 - [http://www.mozilla.org/rhino/ Rhino] - command line JavaScript environment running in Java
 - [https://github.com/jupiterjs/syn Syn] - event simulation library

FuncUnit is designed to let JavaScript developers write tests in an easy to learn jQuery-like syntax. 
The tests will run in browser, so developers can check for regressions as they work.  The same tests also run 
via Selenium, so QA can automate nightly builds or continuous integration.

## Why FuncUnit

TESTING IS PAINFUL.  Everyone hates testing, and most front end developers simply don't test.  There 
are a few reasons for this:

1. **Barriers to entry** - Difficult setup, installation, high cost, or difficult APIs.  QTP costs $5K per license.
2. **Completely foreign APIs** - Testing frameworks often use other languages (Ruby, C#, Java) and new APIs.
3. **Debugging across platforms** - You can't use firebug to debug a test that's driven by PHP.
4. **Low fidelity event simulation** - Tests are often brittle or low fidelity because frameworks aren't designed to test heavy JavaScript apps, so 
browser event simualation accuracy isn't a top priority.
5. **QA and developers can't communicate** - If only QA has the ability to run tests, sending bug reports is messy and time consuming.

FuncUnit aims to fix these problems:

1. FuncUnit is free and has no setup or installation (just requires Java and a browser). 
2. FuncUnit devs know jQuery, and FuncUnit leverages that knowldge with a jQuery-like API.
3. You can run tests in browser and set Firebug breakpoints.
4. Syn.js is a low level event simuation library that goes to extra trouble to make sure each browser simulates events exactly as intended.
5. Since tests are just JS and HTML, they can be checked into a project and any dev can run them easily.  QA just needs to send a URL to a broken 
test case.

There are many testing frameworks out there, but nothing comes close to being a complete solution for front end testing like FuncUnit does.

 * @constructor
 * selects something in the other page
 * @param {String|Function|Object} selector FuncUnit behaves differently depending if
 * the selector is a string, a function, or an object.
 * <h5>String</h5>
 * The selector is treated as a css selector.  
 * jQuery/Sizzle is used as the selector so any selector it understands
 * will work with funcUnit.  FuncUnit does not perform the selection until a
 * command is called upon this selector.  This makes aliasing the selectors to
 * JavaScript variables a great technique.
 * <h5>Function</h5>
 * If a function is provided, it will add that function to the action queue to be run
 * after previous actions and waits.
 * <h5>Object</h5>
 * If you want to reference the window or document, pass <code>S.window</code> 
 * or <code>S.window.document</code> to the selector.  
 * 
 * @param {Number} [context] If provided, the context is the frame number in the
 * document.frames array to use as the context of the selector.  For example, if you
 * want to select something in the first iframe of the page:
 * 
 *     S("a.mylink",0)
 */
FuncUnit = function(selector, context){
	// if someone wraps a funcunit selector
	if(selector && selector.funcunit === true){
		return selector;
	}
	if(typeof selector == "function"){
		return FuncUnit.wait(0, selector);
	}
	
	return new FuncUnit.init(selector, context)
}
/**
 * @Static
 */
window.jQuery.extend(FuncUnit,oldFunc)
window.jQuery.extend(FuncUnit,{
	//move jquery and clear it out
	jquery : jQuery.noConflict(true),
/**
 * @attribute href
 * The location of the page running the tests on the server and where relative paths passed in to [FuncUnit.static.open] will be 
 * referenced from.
 * <p>This is typically where the test page runs on the server.  It can be set before calls to [FuncUnit.static.open]:</p>
@codestart
test("opening something", function(){
  S.href = "http://localhost/tests/mytest.html"
  S.open("../myapp")
  ...
})
@codeend
 */
// href comes from settings
/**
 * @attribute jmvcRoot
 * jmvcRoot should be set to url of JMVC's root folder.  
 * <p>This is used to calculate JMVC style paths (paths that begin with  //).
 * This is the prefered method of referencing pages if
 * you want to test on the filesystem and test on the server.</p>
 * <p>This is usually set in the global config file in <code>funcunit/settings.js</code> like:</p>
@codestart
FuncUnit = {jmvcRoot: "http://localhost/script/" }
@codeend
 */
// jmvcRoot comes from settings

/**
 * Opens a page.  It will error if the page can't be opened before timeout. 
 * <h3>Example</h3>
@codestart
//a full url
S.open("http://localhost/app/app.html")

//from jmvc root (FuncUnit.jmvcRoot must be set)
S.open("//app/app.html")
@codeend

 * <h3>Paths in Selenium</h3>
 * Selenium runs the testing page from the filesystem and by default will look for pages on the filesystem unless provided a full
 * url or information that can translate a partial path into a full url. FuncUnit uses [FuncUnit.static.jmvcRoot] 
 * and [FuncUnit.static.href] to 
 * translate partial paths.
<table>
  <tr>
  	<th>path</th>
  	<th>jmvcRoot</th>
  	<th>href</th>
  	<th>resulting url</th>
  </tr>
  <tr>
    <td>//myapp/mypage.html</td>
    <td>null</td>
    <td>null</td>
    <td>file:///C:/development/cookbook/public/myapp/mypage.html</td>
  </tr>
  <tr>
    <td>//myapp/mypage.html</td>
    <td>http://localhost/</td>
    <td></td>
    <td>http://localhost/myapp/mypage.html</td>
  </tr>
  <tr>
    <td>http://foo.com</td>
    <td></td>
    <td></td>
    <td>http://foo.com</td>
  </tr>
  <tr>
  	<td>../mypage.html</td>
    <td></td>
    <td>http://localhost/myapp/funcunit.html</td>
    <td>http://localhost/mypage.html</td>
  </tr>
</table>
 * 
 * @param {String} path a full or partial url to open.  If a partial is given, 
 * @param {Function} callback
 * @param {Number} timeout
 */
open: function( path, callback, timeout ) {
	var fullPath = FuncUnit.getAbsolutePath(path), 
	temp;
	if(typeof callback != 'function'){
		timeout = callback;
		callback = undefined;
	}
	FuncUnit.add({
		method: function(success, error){ //function that actually does stuff, if this doesn't call success by timeout, error will be called, or can call error itself
			steal.dev.log("Opening " + path)
			FuncUnit._open(fullPath, error);
			FuncUnit._onload(function(){
				FuncUnit._opened();
				success()
			}, error);
		},
		callback: callback,
		error: "Page " + path + " not loaded in time!",
		timeout: timeout || 30000
	});
},
/**
 * @hide
 * Gets a path, will use steal if present
 * @param {String} path
 */
getAbsolutePath: function( path ) {
	if(typeof(steal) == "undefined" || steal.root == null){
		return path;
	}
	var fullPath, 
		root = FuncUnit.jmvcRoot || steal.root.path;
	
	if (/^\/\//.test(path)) {
		fullPath = new steal.File(path.substr(2)).joinFrom(root);
	}
	else {
		fullPath = path;
	}
	
	if(/^http/.test(path))
		fullPath = path;
	return fullPath;
},
/**
 * @attribute browsers
 * Used to configure the browsers selenium uses to run FuncUnit tests.
 * If you need to learn how to configure selenium, and we haven't filled in this page,
 * post a note on the forum and we will fill this out right away.
 */
// for feature detection
support : {},
/**
 * @attribute window
 * Use this to refer to the window of the application page.  You can also 
 * reference window.document.
 * @codestart
 * S(S.window).innerWidth(function(w){
 *   ok(w > 1000, "window is more than 1000 px wide")
 * })
 * @codeend
 */
window : {
	document: {}
},
_opened: function() {}
});

(function(){
	//the queue of commands waiting to be run
	var queue = [], 
		//are we in a callback function (something we pass to a FuncUnit plugin)
		incallback = false,
		//where we should add things in a callback
		currentPosition = 0;
		
	
	FuncUnit.
	/**
	 * @hide
	 * Adds a function to the queue.  The function is passed within an object that
	 * can have several other properties:
	 * method : the method to be called.  It will be provided a success and error function to call
	 * callback : an optional callback to be called after the function is done
	 * error : an error message if the command fails
	 * timeout : the time until success should be called
	 * bind : an object that will be 'this' of the success
	 * stop : 
	 */
	add = function(handler){
		
		//if we are in a callback, add to the current position
		if (incallback) {
			queue.splice(currentPosition,0,handler)
			currentPosition++;
		}
		else {
			//add to the end
			queue.push(handler);
		}
		//if our queue has just started, stop qunit
		//call done to call the next command
        if (queue.length == 1 && ! incallback) {
			stop();
            setTimeout(FuncUnit._done, 13)
        }
	}
	//this is called after every command
	// it gets the next function from the queue
	FuncUnit._done = function(){
		var next, 
			timer,
			speed = 0;
			
		if(FuncUnit.speed == "slow"){
			speed = 500;
		}
		else if (FuncUnit.speed){
			speed = FuncUnit.speed;
		}
		if (queue.length > 0) {
			next = queue.shift();
			currentPosition = 0;
			// set a timer that will error
			
			
			//call next method
			setTimeout(function(){
				timer = setTimeout(function(){
						next.stop && next.stop();
						ok(false, next.error);
						FuncUnit._done();
					}, 
					(next.timeout || 10000) + speed)
				
				next.method(	//success
					function(){
						//make sure we don't create an error
						clearTimeout(timer);
						
						//mark in callback so the next set of add get added to the front
						
						incallback = true;
						if (next.callback) 
							next.callback.apply(next.bind || null, arguments);
						incallback = false;
						
						
						FuncUnit._done();
					}, //error
					function(message){
						clearTimeout(timer);
						ok(false, message);
						FuncUnit._done();
					})
				
				
			}, speed);
			
		}
		else {
			start();
		}
	}
	FuncUnit.
	/**
	 * Waits a timeout before running the next command.  Wait is an action and gets 
	 * added to the queue.
	 * @codestart
	 * S.wait(100, function(){
	 *   equals( S('#foo').innerWidth(), 100, "innerWidth is 100");
	 * })
	 * @codeend
	 * @param {Number} [time] The timeout in milliseconds.  Defaults to 5000.
	 * @param {Function} [callback] A callback that will run 
	 * 		after the wait has completed, 
	 * 		but before any more queued actions.
	 */
	wait = function(time, callback){
		if(typeof time == 'function'){
			callback = time;
			time = undefined;
		}
		time = time != null ? time : 5000
		FuncUnit.add({
			method : function(success, error){
				steal.dev.log("Waiting "+time)
				setTimeout(success, time)
			},
			callback : callback,
			error : "Couldn't wait!",
			timeout : time + 1000
		});
		return this;
	}
	
	FuncUnit.
	/**
	 * When a browser's native confirm dialog is used, this method is used to repress the dialog and simulate 
	 * clicking OK or Cancel.  Alerts are repressed by default in FuncUnit application windows.
	 * @codestart
	 * S.confirm(true);
	 * @codeend
	 * @param {Boolean} answer true if you want to click OK, false otherwise
	 */
	confirm = function(answer){}
	
	FuncUnit.
	/**
	 * When a browser's native prompt dialog is used, this method is used to repress the dialog and simulate 
	 * clicking typing something into the dialog.
	 * @codestart
	 * S.prompt("Harry Potter");
	 * @codeend
	 * @param {String} answer Whatever you want to simulate a user typing in the prompt box
	 */
	prompt = function(answer){}
	
	/**
	 * @hide
	 * @function repeat
	 * Takes a function that will be called over and over until it is successful.
	 */
	FuncUnit.repeat = function(checker, callback, error, timeout){
		
		if(typeof timeout == 'function'){
			error = callback;
			callback = timeout;
			
		}
		
		var interval,
			stopped = false	,
			stop = function(){
				clearTimeout(interval)
				stopped = true;
			};

		FuncUnit.add({
			method : function(success, error){
				interval = setTimeout(function(){
					
					var result = null;
					try {
						result = checker()
					} 
					catch (e) {
						//should we throw this too error?
					}
					
					if (result) {
						success();
					}else if(!stopped){
						interval = setTimeout(arguments.callee, 10)
					}
					
				}, 10);
				
				
			},
			callback : callback,
			error : error,
			timeout : timeout,
			stop : stop
		});
		
	}
	
	
	
	FuncUnit.makeArray = function(arr){
		var narr = [];
		for (var i = 0; i < arr.length; i++) {
			narr[i] = arr[i]
		}
		return narr;
	}
	FuncUnit.
	/**
	 * @hide
	 * Converts a string into a Native JS type.
	 * @param {Object} str
	 */
	convert = function(str){
		//if it is an object and not null, eval it
		if (str !== null && typeof str == "object") {
			return object;
		}
		str = String(str);
		switch (str) {
			case "false":
				return false;
			case "null":
				return null;
			case "true":
				return true;
			case "undefined":
				return undefined;
			default:
				if (/^\d+\.\d+$/.test(str) || /^\d+$/.test(str)) {
					return 1 * str;
				}
				
				return str;
		}
	}

})();


/**
 * @prototype
 */
FuncUnit.init = function(s, c){
	this.selector = s;
	this.context = c == null ? FuncUnit.window.document : c;
}
FuncUnit.init.prototype = {
	funcunit : true,
	/**
	 * Types text into an element.  This makes use of [Syn.type] and works in 
	 * a very similar way.
	 * <h3>Quick Examples</h3>
	 * @codestart
	 * //types hello world
	 * S('#bar').type('hello world')
	 * 
	 * //submits a form by typing \r
	 * S("input[name=age]").type("27\r")
	 * 
	 * //types FuncUnit, then deletes the Unit
	 * S('#foo').type("FuncUnit\b\b\b\b")
	 * 
	 * //types JavaScriptMVC, then removes the MVC
	 * S('#zar').type("JavaScriptMVC[left][left][left]"+
	 *                      "[delete][delete][delete]")
	 *          
	 * //types JavaScriptMVC, then selects the MVC and
	 * //deletes it
	 * S('#zar').type("JavaScriptMVC[shift]"+
	 *                "[left][left][left]"+
	 *                "[shift-up][delete]")
	 * @codeend
	 * <h2>Characters</h2>
	 * 
	 * For a list of the characters you can type, check [Syn.keycodes].
	 * 
	 * @param {String} text the text you want to type
	 * @param {Function} [callback] a callback that is run after typing, but before the next action.
	 * @return {FuncUnit} returns the funcUnit for chaining.
	 */
	type: function( text, callback ) {
		var selector = this.selector, 
			context = this.context;
		FuncUnit.add({
			method : function(success, error){
				steal.dev.log("Typing "+text+" on "+selector)
				FuncUnit.$(selector, context, "triggerSyn", "_type", text, success)
			},
			callback : callback,
			error : "Could not type " + text + " into " + this.selector,
			bind : this
		});
		return this;
	},
	/**
	 * Waits until an element exists before running the next action.
	 * @codestart
	 * //waits until #foo exists before clicking it.
	 * S("#foo").exists().click()
	 * @codeend
	 * @param {Function} [callback] a callback that is run after the selector exists, but before the next action.
	 * @return {FuncUnit} returns the funcUnit for chaining. 
	 */
	exists: function( callback ) {
		if(true){
			return this.size(function(size){
				return size > 0;
			}, callback)
		}
		return this.size() == 0;
	},
	/**
	 * Waits until no elements are matched by the selector.  Missing is equivalent to calling
	 * <code>.size(0, callback);</code>
	 * @codestart
	 * //waits until #foo leaves before continuing to the next action.
	 * S("#foo").missing()
	 * @codeend
	 * @param {Function} [callback] a callback that is run after the selector exists, but before the next action
	 * @return {FuncUnit} returns the funcUnit for chaining. 
	 */
	missing: function( callback ) {
		return this.size(0, callback)
	},
	/**
	 * Waits until the funcUnit selector is visible.  
	 * @codestart
	 * //waits until #foo is visible.
	 * S("#foo").visible()
	 * @codeend
	 * @param {Function} [callback] a callback that runs after the funcUnit is visible, but before the next action.
	 * @return [funcUnit] returns the funcUnit for chaining.
	 */
	visible: function( callback ) {
		var self = this,
			sel = this.selector,
			ret;
		this.selector += ":visible"
		if(true){
			return this.size(function(size){
				return size > 0;
			}, function(){
				self.selector = sel;
				callback && callback();
			})
		}else{
			ret = this.size() > 0;
			this.selector = sel;
			return ret;
		}
		
	},
	/**
	 * Waits until the selector is invisible.  
	 * @codestart
	 * //waits until #foo is invisible.
	 * S("#foo").invisible()
	 * @codeend
	 * @param {Function} [callback] a callback that runs after the selector is invisible, but before the next action.
	 * @return [funcUnit] returns the funcUnit selector for chaining.
	 */
	invisible: function( callback ) {
		var self = this,
			sel = this.selector,
			ret;
		this.selector += ":visible"
		return this.size(0, function(){
			self.selector = sel;
			callback && callback();
		})
	},
	/**
	 * Drags an element into another element or coordinates.  
	 * This takes the same paramameters as [Syn.prototype.move move].
	 * @param {String|Object} options A selector or coordinates describing the motion of the drag.
	 * <h5>Options as a Selector</h5>
	 * Passing a string selector to drag the mouse.  The drag runs to the center of the element
	 * matched by the selector.  The following drags from the center of #foo to the center of #bar.
	 * @codestart
	 * S('#foo').drag('#bar') 
	 * @codeend
	 * <h5>Options as Coordinates</h5>
	 * You can pass in coordinates as clientX and clientY:
	 * @codestart
	 * S('#foo').drag('100x200') 
	 * @codeend
	 * Or as pageX and pageY
	 * @codestart
	 * S('#foo').drag('100X200') 
	 * @codeend
	 * Or relative to the start position
	 * S('#foo').drag('+10 +20')
	 * <h5>Options as an Object</h5>
	 * You can configure the duration, start, and end point of a drag by passing in a json object.
	 * @codestart
	 * //drags from 0x0 to 100x100 in 2 seconds
	 * S('#foo').drag({
	 *   from: "0x0",
	 *   to: "100x100",
	 *   duration: 2000
	 * }) 
	 * @codeend
	 * @param {Function} [callback] a callback that runs after the drag, but before the next action.
	 * @return {funcUnit} returns the funcunit selector for chaining.
	 */
	drag: function( options, callback ) {
		if(typeof options == 'string'){
			options = {to: options}
		}
		options.from = this.selector;

		var selector = this.selector, 
			context = this.context;
		FuncUnit.add({
			method: function(success, error){
				steal.dev.log("dragging " + selector)
				FuncUnit.$(selector, context, "triggerSyn", "_drag", options, success)
			},
			callback: callback,
			error: "Could not drag " + this.selector,
			bind: this
		})
		return this;
	},
		/**
	 * Moves an element into another element or coordinates.  This will trigger mouseover
	 * mouseouts accordingly.
	 * This takes the same paramameters as [Syn.prototype.move move].
	 * @param {String|Object} options A selector or coordinates describing the motion of the move.
	 * <h5>Options as a Selector</h5>
	 * Passing a string selector to move the mouse.  The move runs to the center of the element
	 * matched by the selector.  The following moves from the center of #foo to the center of #bar.
	 * @codestart
	 * S('#foo').move('#bar') 
	 * @codeend
	 * <h5>Options as Coordinates</h5>
	 * You can pass in coordinates as clientX and clientY:
	 * @codestart
	 * S('#foo').move('100x200') 
	 * @codeend
	 * Or as pageX and pageY
	 * @codestart
	 * S('#foo').move('100X200') 
	 * @codeend
	 * Or relative to the start position
	 * S('#foo').move('+10 +20')
	 * <h5>Options as an Object</h5>
	 * You can configure the duration, start, and end point of a move by passing in a json object.
	 * @codestart
	 * //drags from 0x0 to 100x100 in 2 seconds
	 * S('#foo').move({
	 *   from: "0x0",
	 *   to: "100x100",
	 *   duration: 2000
	 * }) 
	 * @codeend
	 * @param {Function} [callback] a callback that runs after the drag, but before the next action.
	 * @return {funcUnit} returns the funcunit selector for chaining.
	 */
	move: function( options, callback ) {
		if(typeof options == 'string'){
			options = {to: options}
		}
		options.from = this.selector;

		var selector = this.selector, 
			context = this.context;
		FuncUnit.add({
			method: function(success, error){
				steal.dev.log("moving " + selector)
				FuncUnit.$(selector, context, "triggerSyn", "_move", options, success)
			},
			callback: callback,
			error: "Could not move " + this.selector,
			bind: this
		});
		return this;
	},
	/**
	 * Scrolls an element in a particular direction by setting the scrollTop or srollLeft.
	 * @param {String} direction "left" or "top"
	 * @param {Number} amount number of pixels to scroll
	 * @param {Function} callback
	 */
	scroll: function( direction, amount, callback ) {
		var selector = this.selector, 
			context = this.context,
			direction = /left|right|x/i.test(direction)? "Left" : "Right";
		FuncUnit.add({
			method: function(success, error){
				steal.dev.log("setting " + selector + " scroll" + direction + " " + amount + " pixels")
				FuncUnit.$(selector, context, "scroll" + direction, amount)
				success();
			},
			callback: callback,
			error: "Could not scroll " + this.selector,
			bind: this
		});
		return this;
	},
	/**
	 * Waits a timeout before calling the next action.  This is the same as
	 * [FuncUnit.prototype.wait].
	 * @param {Number} [timeout]
	 * @param {Object} callback
	 */
	wait: function( timeout, callback ) {
		FuncUnit.wait(timeout, callback)
	},
	/**
	 * Returns a FuncUnit wrapped selector with 
	 * selector appended to the current selector.
	 * @codestart
	 * S('#foo').find(".bar") //-> S("#foo .bar")
	 * @codeend
	 * @param {String} selector
	 * @return {FuncUnit} the funcunit wrapped selector.
	 */

	find : function(selector){
		return FuncUnit(this.selector+" "+selector, this.context);
	},
	/**
	 * Calls the callback function after all previous asynchronous actions have completed.  Then
	 * is called with the funcunit object.
	 * @param {Object} callback
	 */
	then : function(callback){
		var self = this;
		FuncUnit.wait(0, function(){
			callback.call(self, self);
		});
		return this;
	}
};
//do traversers
var traversers = ["closest",


"next","prev","siblings","last","first"],
	makeTraverser = function(name){
		FuncUnit.init.prototype[name] = function(selector){
			return FuncUnit( FuncUnit.$(this.selector, this.context, name+"Selector", selector), this.context )
		}
	};
for(var i  =0; i < traversers.length; i++){
	makeTraverser(traversers[i]);
}

// do clicks
var clicks = [
/**
 * @function click
 * Clicks an element.  This uses [Syn.prototype.click] to issue a:
 * <ul>
 * 	<li><code>mousedown</code></li>
 *  <li><code>focus</code> - if the element is focusable</li>
 *  <li><code>mouseup</code></li>
 *  <li><code>click</code></li>
 * </ul>
 * If no clientX/Y or pageX/Y is provided as options, the click happens at the 
 * center of the element.
 * <p>For a right click or double click use [FuncUnit.prototype.rightClick] or
 *   [FuncUnit.prototype.dblclick].</p>
 * <h3>Example</h3>
 * @codestart
 * //clicks the bar element
 * S("#bar").click()
 * @codeend
 * @param {Object} [options] options to pass to the click event.  Typically, this is clientX/Y or pageX/Y like:
 * @codestart
 * $('#foo').click({pageX: 200, pageY: 100});
 * @codeend
 * You can pass it any of the serializable parameters you'd send to : 
 * [http://developer.mozilla.org/en/DOM/event.initMouseEvent initMouseEvent], but command keys are 
 * controlled by [FuncUnit.prototype.type].
 * @param {Function} [callback] a callback that runs after the click, but before the next action.
 * @return {funcUnit} returns the funcunit selector for chaining.
 */
'click',
/**
 * @function dblclick
 * Double clicks an element by [FuncUnit.prototype.click clicking] it twice and triggering a dblclick event.
 * @param {Object} options options to add to the mouse events.  This works
 * the same as [FuncUnit.prototype.click]'s options.
 * @param {Function} [callback] a callback that runs after the double click, but before the next action.
 * @return {funcUnit} returns the funcunit selector for chaining.
 */
'dblclick',
/**
 * @function rightClick
 * Right clicks an element.  This typically results in a contextmenu event for browsers that
 * support it.
 * @param {Object} options options to add to the mouse events.  This works
 * the same as [FuncUnit.prototype.click]'s options.
 * @param {Function} [callback] a callback that runs after the click, but before the next action.
 * @return {funcUnit} returns the funcunit selector for chaining.
 */
'rightClick'],
	makeClick = function(name){
		FuncUnit.init.prototype[name] = function(options, callback){
			if(typeof options == 'function'){
				callback = options;
				options = {};
			}
			var selector = this.selector, 
				context = this.context;
			FuncUnit.add({
				method: function(success, error){
					options = options || {}
					steal.dev.log("Clicking " + selector)
					FuncUnit.$(selector, context, "triggerSyn", "_" + name, options, success)
				},
				callback: callback,
				error: "Could not " + name + " " + this.selector,
				bind: this
			});
			return this;
		}
	}

for(var i=0; i < clicks.length; i++){
	makeClick(clicks[i])
}


//list of jQuery functions we want, number is argument index
//for wait instead of getting value
FuncUnit.funcs = {
/**
 * @function size
 * Gets the number of elements matched by the selector or
 * waits until the the selector is size.  You can also 
 * provide a function that continues to the next action when
 * it returns true.
 * @codestart
 * S(".recipe").size() //gets the number of recipes
 * 
 * S(".recipe").size(2) //waits until there are 2 recipes
 * 
 * //waits until size is count
 * S(".recipe").size(function(size){
 *   return size == count;
 * })
 * @codeend
 * @param {Number|Function} [size] number or a checking function.
 * @param {Function} a callback that will run after this action completes.
 * @return {Number} if the size parameter is not provided, size returns the number
 * of elements matched.
 */
'size' : 0,
/**
 * @function trigger
 * Triggers an event on a set of elements in the page.  Use it to trigger
 * custom user events that a user can't easily simulate.  Do NOT use
 * it to simulate 'click' and 'keypress' events, that is what .click() and .type() 
 * are for.  This only works if the page you are testing has jQuery in it.
 * @codestart
 * S('#foo').trigger("myCustomEvent")
 * @codeend
 * @param {String} eventType A string containing a JavaScript event type, such as click or submit.
 */
'trigger' : 100,
/**
 * @attr data
 * Gets data from jQuery.data or waits until data
 * equals some value.  
 * @codestart
 * S("#something").data("abc") //gets the abc data
 * 
 * S("#something").data("abc","some") //waits until the data == some
 * @codeend
 * @param {String} data The data to get, or wait for.
 * @param {Object|Function} [value] If provided uses this as a check before continuing to the next action.
 * @param {Function} a callback that will run after this action completes.
 * @return {Object} if the size parameter is not provided, returns
 * the object.
 */
'data': 1, 
/**
 * @function attr
 * Gets the value of an attribute from an element or waits until the attribute
 * equals the attr param.
 * @codestart
 *  //gets the abc attribute
 * S("#something").attr("abc")
 * 
 * //waits until the abc attribute == some
 * S("#something").attr("abc","some") 
 * @codeend
 * @param {String} data The attribute to get, or wait for.
 * @param {String|Function} [value] If provided uses this as a check before continuing to the next action.
 * @param {Function} a callback that will run after this action completes.
 * @return {Object} if the attr parameter is not provided, returns
 * the attribute.
 */
'attr' : 1, 
/**
 * @function hasClass
 * @codestart
 * //returns if the element has the class in its className
 * S("#something").hasClass("selected");
 * 
 * //waits until #something has selected in its className
 * S("#something").hasClass("selected",true);
 * 
 * //waits until #something does not have selected in its className
 * S("#something").hasClass("selected",false);
 * @codeend
 * @param {String} className The part of the className to search for.
 * @param {Boolean|Function} [value] If provided uses this as a check before continuing to the next action.
 * @param {Function} [callback] a callback that will run after this action completes.
 * @return {Boolean|funcUnit} if the value parameter is not provided, returns
 * if the className is found in the element's className.  If a value paramters is provided, returns funcUnit for chaining.
 */
'hasClass' : 1, //makes wait
/**
 * @function html
 * Gets the [http://api.jquery.com/html/ html] from an element or waits until the html is a certain value.
 * @codestart
 * //checks foo's html has "JupiterJS"
 * ok( /JupiterJS/.test( S('#foo').html() ) )
 * 
 * //waits until bar's html has JupiterJS
 * S('#foo').html(/JupiterJS/)
 * 
 * //waits until bar's html is JupiterJS
 * S('#foo').html("JupiterJS")
 * @codeend
 * 
 * @param {String|Function} [html] If provided uses this as a check before continuing to the next action.
 * @param {Function} [callback] a callback that will run after this action completes.
 * @return {String|funcUnit} if the html parameter is provided, 
 * returns the funcUnit selector for chaining, otherwise returns the html of the selector.
 */
'html' : 0, 
/**
 * @function text
 * Gets the [http://api.jquery.com/text/ text] from an element or waits until the text is a certain value.
 * @codestart
 * //checks foo's text has "JupiterJS"
 * ok( /JupiterJS/.test( S('#foo').text() ) )
 * 
 * //waits until bar's text has JupiterJS
 * S('#foo').text(/JupiterJS/)
 * 
 * //waits until bar's text is JupiterJS
 * S('#foo').text("JupiterJS")
 * @codeend
 * 
 * @param {String|Function} [text] If provided uses this as a check before continuing to the next action.
 * @param {Function} [callback] a callback that will run after this action completes.
 * @return {String|funcUnit} if the text parameter is provided, 
 * returns the funcUnit selector for chaining, otherwise returns the html of the selector.
 */
'text' : 0, 
/**
 * @function val
 * Gets the [http://api.jquery.com/val/ val] from an element or waits until the val is a certain value.
 * @codestart
 * //checks foo's val has "JupiterJS"
 * ok( /JupiterJS/.test( S('input#foo').val() ) )
 * 
 * //waits until bar's val has JupiterJS
 * S('input#foo').val(/JupiterJS/)
 * 
 * //waits until bar's val is JupiterJS
 * S('input#foo').val("JupiterJS")
 * @codeend
 * 
 * @param {String|Function} [val] If provided uses this as a check before continuing to the next action.
 * @param {Function} [callback] a callback that will run after this action completes.
 * @return {String|funcUnit} if the val parameter is provided, 
 * returns the funcUnit selector for chaining, otherwise returns the html of the selector.
 */
'val' : 0, 
/**
 * @function css
 * Gets a [http://api.jquery.com/css/ css] property from an element or waits until the property is 
 * a specified value.
 * @codestart
 * // gets the color
 * S("#foo").css("color")
 * 
 * // waits until the color is red
 * S("#foo").css("color","red") 
 * @codeend
 * 
 * @param {String} prop A css property to get or wait until it is a specified value.
 * @param {String|Function} [val] If provided uses this as a check before continuing to the next action.
 * @param {Function} [callback] a callback that will run after this action completes.
 * @return {String|funcUnit} if the val parameter is provided, 
 * returns the funcUnit selector for chaining, otherwise returns the css of the selector.
 */
'css': 1, 
/**
 * @function offset
 * Gets an element's [http://api.jquery.com/offset/ offset] or waits until 
 * the offset is a specified value.
 * @codestart
 * // gets the offset
 * S("#foo").offset();
 * 
 * // waits until the offset is 100, 200
 * S("#foo").offset({top: 100, left: 200}) 
 * @codeend
 * 
 * @param {Object|Function} [offset] If provided uses this as a check before continuing to the next action.  Or you can 
 * provide a function that returns true to continue to the next action.
 * @param {Function} [callback] a callback that will run after this action completes.
 * @return {String|funcUnit} if the offset parameter is provided, 
 * returns the funcUnit selector for chaining, otherwise returns the css of the selector.
 */
'offset' : 0,
/**
 * @function position
 * Gets an element's [http://api.jquery.com/position/ position] or waits until 
 * the position is a specified value.
 * @codestart
 * // gets the position
 * S("#foo").position();
 * 
 * // waits until the position is 100, 200
 * S("#foo").position({top: 100, left: 200}) 
 * @codeend
 * 
 * @param {Object|Function} [position] If provided uses this as a check before continuing to the next action.  Or you can 
 * provide a function that returns true to continue to the next action.
 * @param {Function} [callback] a callback that will run after this action completes.
 * @return {String|funcUnit} if the position parameter is provided, 
 * returns the funcUnit selector for chaining, otherwise returns the offset of the selector.
 */
'position' : 0,
/**
 * @function scrollTop
 * Gets an element's [http://api.jquery.com/scrollTop/ scrollTop] or waits until 
 * it equals a specified value.
 * @codestart
 * // gets the scrollTop
 * S("#foo").scrollTop();
 * 
 * // waits until the scrollTop is 100
 * S("#foo").scrollTop(100) 
 * @codeend
 * 
 * @param {Number|Function} [scrollTop] If provided uses this as a check before continuing to the next action.  Or you can 
 * provide a function that returns true to continue to the next action.
 * @param {Function} [callback] a callback that will run after this action completes.
 * @return {String|funcUnit} if scrollTop is provided, 
 * returns the funcUnit selector for chaining, otherwise returns the scrollTop of the selector.
 */ 
'scrollTop' : 0, 
/**
 * @function scrollLeft
 * Gets an element's [http://api.jquery.com/scrollLeft/ scrollLeft] or waits until 
 * it equals a specified value.
 * @codestart
 * // gets the scrollLeft
 * S("#foo").scrollLeft();
 * 
 * // waits until the scrollLeft is 100
 * S("#foo").scrollLeft(100) 
 * @codeend
 * 
 * @param {Number|Function} [scrollLeft] If provided uses this as a check before continuing to the next action.  Or you can 
 * provide a function that returns true to continue to the next action.
 * @param {Function} [callback] a callback that will run after this action completes.
 * @return {String|funcUnit} if scrollLeft is provided, 
 * returns the funcUnit selector for chaining, otherwise returns the scrollLeft of the selector.
 */ 
'scrollLeft' : 0, 
/**
 * @function height
 * Gets an element's [http://api.jquery.com/height/ height] or waits until 
 * it equals a specified value.
 * @codestart
 * // gets the height
 * S("#foo").height();
 * 
 * // waits until the height is 100
 * S("#foo").height(100) 
 * @codeend
 * 
 * @param {Number|Function} [height] If provided uses this as a check before continuing to the next action.  Or you can 
 * provide a function that returns true to continue to the next action.
 * @param {Function} [callback] a callback that will run after this action completes.
 * @return {String|funcUnit} if height is provided, 
 * returns the funcUnit selector for chaining, otherwise returns the height of the selector.
 */
'height' : 0, 
/**
 * @function width
 * Gets an element's [http://api.jquery.com/width/ width] or waits until 
 * it equals a specified value.
 * @codestart
 * // gets the width
 * S("#foo").width();
 * 
 * // waits until the width is 100
 * S("#foo").width(100) 
 * @codeend
 * 
 * @param {Number|Function} [width] If provided uses this as a check before continuing to the next action.  Or you can 
 * provide a function that returns true to continue to the next action.
 * @param {Function} [callback] a callback that will run after this action completes.
 * @return {String|funcUnit} if width is provided, 
 * returns the funcUnit selector for chaining, otherwise returns the width of the selector.
 */
'width' : 0, 
/**
 * @function innerHeight
 * Gets an element's [http://api.jquery.com/innerHeight/ innerHeight] or waits until 
 * it equals a specified value.
 * @codestart
 * // gets the innerHeight
 * S("#foo").innerHeight();
 * 
 * // waits until the innerHeight is 100
 * S("#foo").innerHeight(100) 
 * @codeend
 * 
 * @param {Number|Function} [innerHeight] If provided uses this as a check before continuing to the next action.  Or you can 
 * provide a function that returns true to continue to the next action.
 * @param {Function} [callback] a callback that will run after this action completes.
 * @return {String|funcUnit} if innerHeight is provided, 
 * returns the funcUnit selector for chaining, otherwise returns the innerHeight of the selector.
 */
'innerHeight' : 0, 
/**
 * @function innerWidth
 * Gets an element's [http://api.jquery.com/innerWidth/ innerWidth] or waits until 
 * it equals a specified value.
 * @codestart
 * // gets the innerWidth
 * S("#foo").innerWidth();
 * 
 * // waits until the innerWidth is 100
 * S("#foo").innerWidth(100) 
 * @codeend
 * 
 * @param {Number|Function} [innerWidth] If provided uses this as a check before continuing to the next action.  Or you can 
 * provide a function that returns true to continue to the next action.
 * @param {Function} [callback] a callback that will run after this action completes.
 * @return {String|funcUnit} if innerWidth is provided, 
 * returns the funcUnit selector for chaining, otherwise returns the innerWidth of the selector.
 */
'innerWidth' : 0, 
/**
 * @function outerHeight
 * Gets an element's [http://api.jquery.com/outerHeight/ outerHeight] or waits until 
 * it equals a specified value.
 * @codestart
 * // gets the outerHeight
 * S("#foo").outerHeight();
 * 
 * // waits until the outerHeight is 100
 * S("#foo").outerHeight(100) 
 * @codeend
 * 
 * @param {Number|Function} [outerHeight] If provided uses this as a check before continuing to the next action.  Or you can 
 * provide a function that returns true to continue to the next action.
 * @param {Function} [callback] a callback that will run after this action completes.
 * @return {String|funcUnit} if outerHeight is provided, 
 * returns the funcUnit selector for chaining, otherwise returns the outerHeight of the selector.
 */
'outerHeight' : 0, 
/**
 * @function outerWidth
 * Gets an element's [http://api.jquery.com/outerWidth/ outerWidth] or waits until 
 * it equals a specified value.
 * @codestart
 * // gets the outerWidth
 * S("#foo").outerWidth();
 * 
 * // waits until the outerWidth is 100
 * S("#foo").outerWidth(100) 
 * @codeend
 * 
 * @param {Number|Function} [outerWidth] If provided uses this as a check before continuing to the next action.  Or you can 
 * provide a function that returns true to continue to the next action.
 * @param {Function} [callback] a callback that will run after this action completes.
 * @return {String|funcUnit} if outerWidth is provided, 
 * returns the funcUnit selector for chaining, otherwise returns the outerWidth of the selector.
 */
'outerWidth' : 0}


//makes a jQuery like command.
FuncUnit.makeFunc = function(fname, argIndex){
	
	//makes a read / wait function
	FuncUnit.init.prototype[fname] = function(){
		//assume last arg is callback
		var args = FuncUnit.makeArray(arguments), 
			callback,
			isWait = args.length > argIndex,
			callback;
		
		args.unshift(this.selector,this.context,fname)

		if(isWait){
			//get the args greater and equal to argIndex
			var tester = args[argIndex+3],
				timeout = args[argIndex+4],
				callback = args[argIndex+5],
				testVal = tester,
				errorMessage = "waiting for "+fname +" on " + this.selector;
			
			if(typeof timeout == 'function'){
				callback = timeout;
				timeout = undefined;
			}
			
			args.splice(argIndex+3, args.length- argIndex - 3);
			
			if(typeof tester != 'function'){
				errorMessage += " !== "+testVal
				tester = function(val){
					
					return QUnit.equiv(val, testVal) || 
						(testVal instanceof RegExp && testVal.test(val) );
				}
			}
			FuncUnit.repeat(function(){
					var ret = FuncUnit.$.apply(FuncUnit.$, args);
					return tester(ret);
				}, callback, errorMessage, timeout)

			return this;
		}else{
			//get the value
			steal.dev.log("Getting "+fname+" on "+this.selector)
			return FuncUnit.$.apply(FuncUnit.$, args);
		}
	}
}
	


for (var prop in FuncUnit.funcs) {
	FuncUnit.makeFunc(prop, FuncUnit.funcs[prop]);
}


S = FuncUnit;

// handle case where syn was loaded before FuncUnit
if(!FuncUnit.jquery.fn.triggerSyn){
	FuncUnit.jquery.fn.triggerSyn = jQuery.fn.triggerSyn;
}
})
//now add drivers
.then('resources/selenium_start',
'drivers/selenium',
'drivers/standard')
