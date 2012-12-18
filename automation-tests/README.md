o hai!

## Getting started

#### Install node dependencies:

    ```npm install```

#### To run tests locally against Firefox, download the selenium-server and make sure it's running:

    curl http://selenium.googlecode.com/files/selenium-server-standalone-2.25.0.jar > selenium-server-standalone-2.25.0.jar
    java -jar selenium-server-standalone-2.25.0.jar```

#### To run tests locally against other browsers, you need to install that browser's driver. See the Selenium wiki for details.

#### To run tests against sauce, put your creds in environment variables:

    * specify sauce username as `PERSONA_SAUCE_USER`
    * specify sauce api key as `PERSONA_SAUCE_APIKEY`
    * Note: If you have these environment variables set, you need to use the "--local" argument to run locally.

#### Running tests

It is possible to run all of the available tests either locally or against
Sauce.

To run one test locally against one browser:

    scripts/run-all.js --local --platform=osx_firefox_15 --tests change-password-test

To run all the tests locally against one browser:

    scripts/run-all.js --local --platform=osx_firefox_15

To run all the tests on Sauce in parallel against one browser:

    scripts/run-all.js --parallel=15 --platform=osx_firefox_15

To run all the tests on Sauce against all supported browsers (beware, totally hogs resources):

    scripts/run-all.js --parallel=15 --platform=all

For help with other run-all.js options:

    scripts/run-all.js --help

#### disabling tests
Tests can be disabled by adding the name of the test file to
config/tests-to-ignore.js. This is useful while developing new test suites that
are not yet ready to be consumed by all browsers.

    exports.tests_to_ignore = [
      "public-terminals.js"
    ];

This ignores the tests in public-terminals.js


## Test Setup

* To get common test fixtures (personatestusers, restmail emails, eyedee.me emails, or browser sessions), use TestSetup.setup:

```testSetup.setup({ browsers: 2, restmails: 1, eyedeemails: 1, personatestusers: 2 }, cb)```

* You can also use a less verbose syntax:

```testSetup.setup({b:2, r:1, e:1, p:2}, cb)```

* Your callback should take an error function and an object that holds all the test fixtures you asked for:

```
  function(err, fixtures) {
    browser = fixtures.browsers[0];
    secondBrowser = fixtures.browsers[1];
    theEmail = fixtures.restmails[0];
    eyedeemail = fixtures.eyedeemails[0];
    firstUser = fixtures.personatestusers[0];
    secondUser = fixtures.personatestusers[1];
  }
```


## Reference: Extensions to wd's API

This code lives in lib/wd-extensions.js

### wait-API: wait, then do X. super useful.

* `wfind(selector, cb(err, el))`: wait until the specified element is displayed, then pass it to cb. Alias for custom extension `waitForDisplayed`.
* `wclick(selector, cb(err))`: wait until the specified element is displayed, then click it
* `wwin(windowName, cb(err))`: wait until the specified window is displayed, then switch to it. Aslias for custom extension `waitForWindow`.
* `wclickIfExists(selector, cb(err))`: wait for a maximum of one second to see if the specified element is displayed, then click it. If element does not exist, continue without an error.
  * calling `wwin()` with no arguments will switch to the main window--not true of `waitForWindow`.
* `wtype(selector, text, cb(err))`: wait until the specified element is displayed, then type into it
  * warning: wd.type() takes an element, not a selector!
* `wtext(selector, cb(err, text))`: wait until the specified element is displayed, then pass its text content to cb
* `wgetAttribute(selector, attrName, cb(err, value))`: wait until the specified element is displayed, then get an attribute value
* `wclear(selector, cb(err))`: wait until the specified element is displayed, then clear it

### other extensions

* `find(selector, cb(err, el))`: find specified element and pass it to cb. Alias for `elementByCss`.
* `click(selector, cb(err))`: click the specified element. Alias for `clickElement`.
* `waitForDisplayed(opts, cb(err, el))`: wait for element to become visible, then switch to it.
  * `opts` can be just the selector, or an object with name, poll, and timeout props.
* `waitForWindow(opts, cb(err))`: wait for window to become visible, then switch to it.
  * `opts` can be just the name, or an object with name, poll, and timeout props.
* `waitForElementText(opts, cb(err, el))`: wait for specified el to have a non-empty text value
  * `opts` can be just the selector, or an object with name, poll, and timeout props.
* `closeCurrentBrowserWindow(cb(err))`: close the currently open browser window and switch to one of the remaining
* `newSession(cb(err))`: allocate a new browser session and sets implicit wait timeout
* `delay(timeout, cb(err))`: delay for the specified amount of time before continuing

## How to run tests on Jenkins and figure out what happened at the Sauce website

#### 1. get jenkins to run a bunch of jobs.
  - jenkins is here: ci.mozilla.org.
  - 1. kick off individual jobs using the IRC bot. yes, really.
    - jenkins lives in #identity and other rooms.
    - syntax: "jenkins: build jobname now"
  - 2. kick off jobs via cron.
    - log in to jenkins using ldap creds.
    - go to the job, click configure, go down to "build triggers" section,
      check "build periodically", use cron-style timers. eg, */5 * * * *
      means every 5 minutes.

#### 2. Get list of failed tests.
For each failed job, click on the date to get to the job view.
This is oddly the only place you can see the list of failed tests.
It might only show an incomplete list of >4 have failed, read carefully.

#### 3. Get sauce links.
Click on 'console output' to get the raw log from the run.
Search for the name of each test, copy the sauce links.

Console output--see anything weird?
Sometimes tests fail because the job crashed.
If you see any weird errors in the console output, that's likely the cause.

#### 4. Look at sauce.
The sauce links go to a page with the video, the JSON wire session, and the 
raw log.
Watch the video, for starters.
After a while, you'll learn to read the commands fired in the session.
What's tricky is that Selenium generally dies trying to find the next thing,
so you have to look at the previous element to see what didn't appear, or
didn't get clicked, or didn't respond soon enough.
The raw log contains java exceptions thrown by the selenium server; if weird
errors or timeouts after 300 sec occur, you'll see better diagnostics here.
Note that the raw log just refers to, say, "element 10". The main page actually
shows what the CSS selector was for element 10.

#### 5. Write down WTF happened; I use github gists usually.

#### 6. Classify your failures by type, file bugs, fix 'em

## Refs

* [admc/wd](https://github.com/admc/wd) is our webdriver library
* WebDriver's [JSON wire protocol](http://code.google.com/p/selenium/wiki/JsonWireProtocol#/session/:sessionId/timeouts/implicit_wait) is what lives under the language bindings
* Currently open testing bugs are filed against [mozilla/browserid](https://github.com/mozilla/browserid)
