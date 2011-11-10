/**
@page writing 2. Writing FuncUnit Tests
@parent FuncUnit

 * <p>Writing tests is super easy and follows this pattern:</p>
<ol>
  <li>Open a page with [FuncUnit.static.open S.open].
@codestart
S.open("//myapp/myapp.html")
@codeend
  </li>
  <li>Do some things
@codestart
//click something
S('#myButton').click()

//type something
S('#myInput').type("hello")
@codeend
  </li>

  <li>Wait for the page to change:
@codestart
//Wait until it is visible
S('#myMenu').visible()

//wait until something exists
S('#myArea').exists()
@codeend
  </li>
  <li>Check your page in a callback:
@codestart
S('#myMenu').visible(function(){
  //check that offset is right
  equals(S('#myMenu').offset().left, 500, 
    "menu is in the right spot");
})
@codeend
  </li>
</ol>
<h2>Actions, Waits, and Getters</h2>
<p>FuncUnit supports three types of commands: asynchronous actions and waits, 
and synchronous getters.</p>
<p><b>Actions</b> are used to simulate user behavior such as clicking, typing, moving the mouse.</p>
<p><b>Waits</b> are used to pause the test script until a condition has been met.</p>
<p><b>Getters</b> are used to get information about elements in the page</p>
<p>Typically, a test looks like a series of action and wait commands followed by qUnit test of
the result of a getter command.  Getter commands are almost always in a action or wait callback.</p>
<h3>Actions</h3>
Actions simulate user behavior.  FuncUnit provides the following actions:

 - <code>[FuncUnit.static.open open]</code> - opens a page.
 - <code>[FuncUnit.prototype.click click]</code> - clicks an element (mousedown, mouseup, click).
 - <code>[FuncUnit.prototype.dblclick dblclick]</code> - two clicks followed by a dblclick.
 - <code>[FuncUnit.prototype.rightClick rightClick]</code> - a right mousedown, mouseup, and contextmenu.
 - <code>[FuncUnit.prototype.type type]</code> - types characters into an element.
 - <code>[FuncUnit.prototype.move move]</code> - mousemove, mouseover, and mouseouts from one element to another.
 - <code>[FuncUnit.prototype.drag drag]</code> - a drag motion from one element to another.
 - <code>[FuncUnit.prototype.scroll scroll]</code> - scrolls an element.

Actions run asynchronously, meaning they do not complete all their events immediately.  
However, each action is queued so that you can write actions (and waits) linearly.

The following might simulate typing and resizing a "resizable" textarea plugin:

@codestart
S.open('resizableTextarea.html');

S('textarea').click().type("Hello World");
  
S('.resizer').drag("+20 +20");
@codeend

### Getters

Getters are used to test the conditions of the page.  Most getter commands correspond to a jQuery
method of the same name.  The following getters are provided:

<table style='font-family: monospace'>
<tr>
	<th colspan='2'>Dimensions</th> <th>Attributes</th> <th>Position</th> <th>Selector</th> <th>Style</th>
</tr>
<tr>
	<td>[FuncUnit.prototype.width width]</td>
	<td>[FuncUnit.prototype.height height]</td> 
	<td>[FuncUnit.prototype.attr attr]</td> 
	<td>[FuncUnit.prototype.position position]</td> 
	<td>[FuncUnit.prototype.size size]</td> 
	<td>[FuncUnit.prototype.css css]</td>
</tr>
<tr>
	<td>[FuncUnit.prototype.innerWidth innerWidth]</td>
	<td>[FuncUnit.prototype.innerHeight innerHeight]</td>
	<td>[FuncUnit.prototype.hasClass hasClass]</td>
	<td>[FuncUnit.prototype.offset offset]</td>
	<td>[FuncUnit.prototype.exists exists]</td>
	<td>[FuncUnit.prototype.visible visible]</td>
</tr>
<tr>
	<td>[FuncUnit.prototype.outerWidth outerWidth]</td>
	<td>[FuncUnit.prototype.outerHeight outerHeight]</td>
	<td>[FuncUnit.prototype.val val]</td>
	<td>[FuncUnit.prototype.scrollLeft scrollLeft]</td>
	<td>[FuncUnit.prototype.missing missing]</td>
	<td>[FuncUnit.prototype.invisible invisible]</td>
</tr>
<tr>
	<td colspan='2'></td>
	<td>[FuncUnit.prototype.text text]</td> 
	<td>[FuncUnit.prototype.scrollTop scrollTop]</td>
</tr>
<tr>
	<td colspan='2'></td>
	<td>[FuncUnit.prototype.html html]</td>
</tr>
</table>

Since getters run synchronously, it's important that they happen after the action or wait command completes.
This is why getters are typically found in an action or wait command's callback:

The following performs a drag, then checks that the textarea is 20 pixels taller after the drag.

@codestart
S.open('resizableTextarea.html');

var txtarea = S('textarea'), //save textarea reference
    startingWidth = txtarea.width(), // save references to width and height
    startingHeight = txtarea.height();

S('.resizer').drag("+20 +20", function(){
  equals(txtarea.width(), 
         startingWidth, 
         "width stays the same");
         
  equals(txtarea.height(), 
         startingHeight+20, 
         "height got bigger");
});
@codeend

### Waits

Waits are used to wait for a specific condition to be met before continuing to the next wait or
action command.  Like actions, waits execute asynchronously.  They can be given a callback that runs after 
their wait condition is met.

#### Wait conditions

Every getter commands can become a wait command when given a check value or function.  
For example, the following waits until the width of an element is 200 pixels and tests its offset.

@codestart
var sm = S("#sliderMenu");
sm.width( 200, function(){

  var offset = sm.offset();
  equals( offset.left, 200)
  equals( offset.top, 200)
})
@codeend

#### Wait functions

You can also provide a test function that when true, continues to the next action or wait command.
The following is equivalent to the previous example:

@codestart
var sm = S("#sliderMenu");

sm.width(
  function( width ) {
    return width == 200;
  }, 
  function(){
    var offset = sm.offset();
    equals( offset.left, 200)
    equals( offset.top, 200)
  }
)
@codeend

<div class='whisper'>Notice that the test function is provided the width of the element to use to check.</div>

#### Timeouts

By default, wait commands will wait a 10s timeout period.  If the condition isn't true after that time, the test will fail.  You 
can provide your own timeout for each wait condition as the parameter after the wait condition.  For example, the following will check 
if "#trigger" contains "I was triggered" for 5 seconds before failing the test.

@codestart
("#trigger").text("I was triggered", 5000)
@codeend

#### Timer waits

In addition to all the jQuery-like wait functions, FuncUnit provides [FuncUnit.static.wait S.wait], which waits a timeout before continuing.  
This function should be used with CAUTION.  You should almost never need it, because its presence means brittle tests that depend on unreliable 
timing conditions.  Much better than a time based wait is a wait that depends on a page condition (like a menu element appearing).


 */