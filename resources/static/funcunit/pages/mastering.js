/**

@page mastering 2.1. Mastering the FuncUnit API
@parent FuncUnit

Now that we've introduced the commands, this section will dive deeper into the challenges faced while writing FuncUnit tests and 
some best practices.

### 1. Asynchronous vs synchronous commands

Most FuncUnit commands (all actions and waits) run asynchronously.  This means when a .click() or .visible() method 
runs, it doesn't actually perform a click or check for visible, but rather adds its method to a queue.  After the first method 
in the queue completes, the next one runs.  For example:

@codestart
S(".foo").click();
S(".bar").visible();
S(".myinput").type("abc");
@codeend

In this example, a click and a wait are added to the queue.  The click runs (it is asynchronous).  When it completes, 
FuncUnit checks if ".bar" is visible (and keeps checking until it is).  When this condition becomes true, the next command 
in the queue runs, which types "abc".

The reason they are asynchronous is to let you write linear FuncUnit tests without needing nested callbacks 
for every command.  As a result, tou can't set breakpoints in these methods, but there are other debugging methods.  

Assertions and getters are synchronous commands.  Usually these commands are placed in callbacks for waits and actions.  You 
can set breakpoints in them and inspect the current state of your page.  

### 2. The S method

Its important to realize the S command is NOT the $ command.  It is named S because it acts similarly, but it does not 
return a jQuery collection, and you can't call any jQuery methods on the result.

However, the S method accepts any valid jQuery selector, allows chaining, and lets you call many jQuery like methods on it 
(see the Getters section above).

The reason S is not $ is because when in Selenium mode, the test runs in Rhino, sending commands across Selenium into 
the browser.  So S(".foo") sends JSON to the browser via Selenium that is later used as a parameter for $.  Using $ wouldn't work, since only 
text can be sent across the Selenium bridge, not objects.

### 3. Finding the right wait

After a user clicks or types in your page, something in your page changes.  Something might appear, disappear, get wider, slide left, or show text.  
A good text will take into account what changes after an action, and perform a wait on that condition.  A bad test simply uses S.wait(1000) to wait 
1 second before the next command.  This is error prone, because under certain conditions, the page might be slower than 1 second, causing your test to 
break.

Finding the right wait makes your test bullet proof.

### 4. Debugging tests

Since you can't set breakpoints and step through actions/waits, you might wonder how you can effectively debug.  Here are a few techniques.

#### 1. Simplify

If a test isn't working, comment out all other tests and even all commands after the one thats giving you trouble.  Run the test.  If it does what you expect, 
uncomment one more command and run again.  You can focus on the one part of your test thats giving you trouble.

#### 2. Breakpoints in callbacks

Waits and actions accept a callback that run after they complete.  Inside, you can set breakpoints and inspect your page.  You can also use console.logs 
in callbacks to check conditions that are hard to inspect.

#### 3. Use FuncUnit's logs

Check Firebug's console and you'll during every command, it spits out what its doing.  If a selector isn't working, go to your app window, and use jQuery in the 
console to debug the selector.

### 5. Reuse test code

Often while writing tests for an app, you'll notice steps that need to happen over and over.  For example, you need to click a tab in a tab widget and type in an input 
to get to the screen you want to test.  You can easily create test helper functions, which allow you to DRY your tests a bit.  For example:

@codestart
var openTab = function(tabName){
	S(".tab:contains('"+tabName+"')").click();
	S(".content").visible();
}
@codeend

### 6. Do you need assertions?

As you write tests you'll begin to notice that assertions, while they give you a warm fuzzy feeling, aren't really all that necessary.  You can perform waits for 
the same conditions you'd check in assertions, your code looks more linear and readable without callbacks, and your tests will still fail if the waits fail.

For example, the following are equivalent:

@codestart
// wait for 5 li elements to be present
S(".menu li").size(5);

// check if there are 5 li elements
S(".menu").exists(function(){
	equals(S(".menu li").size(), 5, "there are 5 li's");
})
@codeend

### 7. Working with frames

If your application makes use of iframes, providing a name attribute for your iframes will make testing easier.  The second parameter of S is either the number or 
name of your iframe:

@codestart
// click ".foo" in the frame with name="myframe"
S(".foo", "myframe").click();
@codeend

If you're testing the interaction that causes the iframe to load, don't forget to perform a wait on some condition in the frame that signifies it has completed loading.

### 8. Solving login

When testing an application that requires login, the pattern that seems to work is using a login test that only runs in Selenium mode.  When running in browser, 
developers will already be logged in, so the test can be skipped.  In Selenium however, a new browser instance is opened, so login is required.  Here's an 
example of a login test that does this:

@codestart
test("login test", function () {
	if (navigator.userAgent.match(/Rhino/)) {
		S.open("/login")
		S("#username").exists().click().type("superadmin")
		S("#password").exists().click().type("password")
		S(".submit input").exists().click()
		
		// wait for next page to load
		S(".content").visible(function () {
			ok(true, "logged in");
		})
	} else {
		ok(true, "assuming you are logged in");
	}
})
@codeend

### 9. Use non-brittle selectors

To make your tests as readable and future proof as possible, try to choose jQuery selectors that are both easy to understand and not likely to change.  For example:

#### Good selector

@codestart
S(".contact:contains('Brian')");
@codeend

#### Bad selector

@codestart
S(".contact:eq(4)");
@codeend

### 10. Use pseudocode

Despite FuncUnit's easy to learn API, when you start to write a test, you're thinking in terms of user interactions, not jQuery selectors.  So the easiest way to 
write a test is to start with a method full of pseudocode, then fill in the selectors and commands.

For example:

@codestart
// click the top link
// wait for the edit form to appear
// click the first input, type Chicago
// click submit
// wait for the list to appear
@codeend
 */