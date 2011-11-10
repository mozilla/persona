/**
 
@page runselenium 3. Running Tests Via Selenium
@parent FuncUnit

<h2>Automated Testing with Selenium</h2>
<p>FuncUnit has a command line mode, which allows you to run your tests as part of a checkin script or nightly build.  
The Selenium server is used to automate opening browsers, and FuncUnit commands are sent to the test window via Selenium RC.</p>

<p>The envjs script (written for both Windows and OS X/Linux), is used to load your test page (the 
same one that runs tests in the browser) in Env.js, a simulated browser running on Rhino.  The 
test page recognizes its running in the Rhino context and issues commands to Selenium accordingly.</p>

<p>Running these command line tests is simple:</p>
@codestart
my\path\to\envjs my\path\to\funcunit.html 
@codeend
<p>Configuring settings for the command line mode will be covered next.</p>
<h3>Configuration</h3>
<p>FuncUnit loads a settings.js file every time it is runs in Selenium mode.  This file defines 
configuration that tells Selenium how to run.  You can change which browsers run, their location, 
the domain to serve from, and the speed of test execution.</p>
<p>FuncUnit looks first in the same directory as the funcunit page you're running tests from for 
settings.js.  For example if you're running FuncUnit like this:</p>
@codestart
funcunit\envjs mxui\combobox\funcunit.html 
@codeend
<p>It will look first for mxui/combobox/settings.js.</p>
<p>Then it looks in its own root directory, where a default settings.js exists.  
This is to allow you to create different settings for different projects.</p>
<h3>Setting Browsers</h3>
<p>FuncUnit.browsers is an array that defines which browsers Selenium opens and runs your tests in.  
This is defined in settings.js.  If this null it will default to a standard set of browsers for your OS 
(FF and IE on Windows, FF on everything else).  You populate it with strings like the following:</p>
@codestart
browsers: ["*firefox", "*iexplore", "*safari", "*googlechrome"]
@codeend

To define a custom path to a browser, put this in the string following the browser name like this:</p>

@codestart
browsers: ["*custom /path/to/my/browser"]
@codeend

See the [http://release.seleniumhq.org/selenium-remote-control/0.9.0/doc/java/com/thoughtworks/selenium/DefaultSelenium.html#DefaultSelenium Selenium docs] for more information on customizing browsers and other settings.</p>

## 64-bit Java

Some users will find Selenium has trouble opening while using 64 bit java (on Windows).  You will see an error like  
Could not start Selenium session: Failed to start new browser session.  This is because Selenium 
looks in the 64-bit Program Files directory, and there is no Firefox there.  To fix this, change 
browsers to include the path like this:

@codestart
FuncUnit.browsers = ["*firefox C:\\PROGRA~2\\MOZILL~1\\firefox.exe", "*iexplore"]
@codeend

<h3>Filesystem for Faster Tests</h3>
<p>You might want to use envjs to open local funcunit pages, but test pages on your server.  This is possible, you 
just have to change FuncUnit.href or FuncUnit.jmvcRoot.  This file can load locally while everything else is 
using a server because it is a static file and loads static script files.</p>

<p>Set jmvcRoot to point to the location you want your pages to load from, like this:</p>
@codestart
jmvcRoot: "localhost:8000"
@codeend

<p>Then make sure your test paths contain // in them to signify something relative to the jmvcRoot.  
For example, S.open("//funcunit/test/myapp.html") would open a page at 
http://localhost:8000/funcunit/test/myapp.html.</p>

<p>To load the command page from filesystem, start your test like you normally do:</p>
@codestart
funcunit\envjs path\to\funcunit.html
@codeend

<h3>Running From Safari and Chrome</h3>
<p>Certain browsers, like Safari and Chrome, don't run Selenium tests from filesystem because 
of security resrictions.  To get around this you have to run pages served from a server.  The 
downside of this is the test takes longer to start up, compared to loading from filesystem.</p>  
<p>To run served pages, you must 1) provide an absolute path in your envjs path and 2) provide an absolute path 
in jmvcRoot.</p>
<p>For example, to run cookbook FuncUnit tests from Google Chrome, I'd set the browsers and jmvcRoot like this:</p>
@codestart
	browsers: ["*googlechrome"],
	jmvcRoot: "http://localhost:8000/framework/",
@codeend
<p>then I'd start up Selenium like this:</p>
@codestart
funcunit\envjs http://localhost:8000/framework/cookbook/funcunit.html
@codeend
<p>To run Safari 5 in Windows, you should use the safariproxy browser string like this:</p>
@codestart
	browsers: ["*safariproxy"],
@codeend

Mac Safari is just "*safari".

<h3>Slow Mode</h3>
<p>You can slow down the amount of time between tests by setting FuncUnit.speed.  By default, FuncUnit commands 
in Selenium will run as soon as the previous command is complete.  If you set FuncUnit.speed to "slow" this 
becomes 500ms between commands.  You may also provide a number of milliseconds.  
Slow mode is useful while debugging.</p>

<h2>Limitations</h2>
<ul>
	<li>Selenium doesn't run Chrome/Opera/Safari on the filesystem.</li>
</ul>

<h2>Troubleshooting</h2>

<p>If you have trouble getting Selenium tests to run in IE, there are some settings that you can to change.  First, disable the security settings for pages that run from the filesystem.  To do this, open the Internet Options in IE and select the "Advanced" tab, and enable the option to "Allow active content to run in files on My Computer."  This is what it looks like:</p>

@image jmvc/images/iesecurity.png

<p>You may also get an error that the popup blocker is enabled, which prevents the tests from running.  It's actually not the popup blocker that causes this, but the fix is just as easy.  Simply disable "Protected Mode" in IE, which is also in the Internet Options:</p>

@image jmvc/images/iepopups.png
 */