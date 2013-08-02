Howdy! You've found the selenium tests for browserid.

# Contents

* [Overview](#overview) of Selenium
* [Running tests](#running-tests), how to run 'em
* [Writing tests](#writing-tests), how to get started writing 'em
* [API Reference](#reference-extensions-to-wds-api) covering our convenience methods on top of wd's API
* [Guide to running tests on our communal resources](#how-to-run-tests-on-jenkins-and-figure-out-what-happened-at-the-sauce-website) in case you need to use Jenkins or analyze results on Sauce labs
* [References](#refs)


# Overview

webdriver: tool for automating browsers
  - part of the selenium project
  - the newer API; selenium RC is the older API
  - "local" process (test code and standalone-server) 
  - "remote" process (browser)
    - local and remote may be running on the same machine
  - local & remote communicate via RESTful JSON protocol
    - API: [JSON wire protocol](http://code.google.com/p/selenium/wiki/JsonWireProtocol#/session/:sessionId/timeouts/implicit_wait)
    - supports finding elements, clicking, typing, switching windows, etc
  - JS bindings: admc/wd is a github project that provides node-style javascript bindings
    - see admc/wd README for API docs
    - we wrote a bunch of convenience methods on top (see below in this doc)

Testing strategy overview in the github wiki: [Automated-Browser-Testing](https://github.com/mozilla/browserid/wiki/Automated-Browser-Testing)


# Running tests

## Running tests: installation and startup

#### Install node dependencies:

    npm install

#### Note that this step is only needed if 'npm install' was not run in the parent 'browserid' directory.

#### To run tests locally against Firefox, download the selenium-server and make sure it's running:

    // no need to use 2.25, just use the latest version available :-)
    curl -O http://selenium.googlecode.com/files/selenium-server-standalone-2.25.0.jar
    java -jar selenium-server-standalone-2.25.0.jar

#### To run tests locally against other browsers, you need to install that browser's driver (OperaDriver, ChromeDriver, IEDriver, etc). See the Selenium wiki for details.

#### To run tests against sauce, put your creds in environment variables:

    * specify sauce username as `PERSONA_SAUCE_USER`
    * specify sauce api key as `PERSONA_SAUCE_APIKEY`
    * Note: If you have these environment variables set, you will need to use the "--local" argument to run locally.
    Otherwise, the tests will be run against sauce by default.

## Configuration Files

    *   Selecting the --local option, or setting PERSONA_NO_SAUCE=1 in the environment, will now switch to a different
    config file. The set of supported platforms will be totally generic.

### The sauce configuration file is located here: 

    * browserid/config/sauce-platforms.js
    * Note: This config file should be treated as read-only since the platform list is based on Selenium test support
    through sauce.
    * Note: This file should always be in sync with the Selenium list

### The local host configuration file is located here: browserid/config/config/local-platform.js

    * Five platforms are configured (defined) by default for testing on Mac, Windows, and Linux: firefox, chrome, 
    opera, safari, ie
    * Note: the default binary in the default location is assumed for all supported browsers per platform

### Editing the local host configuration file

    * You can edit this file to add support for more than one FireFox channel
    * The JS file has an example of how that would work
    * Note: You can add support for all four FireFox channels, then run them using the --platform option

## Running tests: scripts/run-all cookbook

It is possible to run all of the available tests either locally or against
Sauce.

### One test, one browser, locally:

    scripts/run-all.js --local --platform=firefox --tests change-password-test

### All tests, one browser, locally:

    scripts/run-all.js --local --platform=firefox

### All tests, one browser, saucelabs:

    scripts/run-all.js --parallel=15 --platform=firefox

### All tests, all browsers, saucelabs: 

    // totally hogs resources, think twice good citizen
    scripts/run-all.js --parallel=15 --platform=all

### Other combinations/options:

    $ scripts/run-all.js --help

    Run automation tests.
    Usage: node ./scripts/run-all.js

    Options:
      --help, -h              display this usage message                                    
      --lp, --list-platforms  list available platforms to test on                           
      --env, -e               target environment: dev/stage/prod or the name of an ephemeral
      --local, -l             run tests locally (instead of on saucelabs)                   
      --parallel, -p          the number of tests to run at the same time                     [default: "10"]
      --platform              the browser/os to test (globs and csv supported)              
      --iterations, -i        the number of times to repeat specified tests                   [default: "1"]
      --list-tests, --lt      list available tests                                          
      --tests, -t             which test(s) to run (globs supported)                          [default: "*"]
      --output, -o            desired ouput format.  one of console, json, xunit              [default: "console"]
      --ignore-tests, --it    test(s) to ignore (csv supported)                             

## Running tests: Disabling tests

Tests can be disabled by adding the name of the test file to
config/tests-to-ignore.js. This is useful while developing new test suites that
are not yet ready to be consumed by all browsers.

    exports.tests_to_ignore = [
      "public-terminals.js"
    ];

This ignores the tests in public-terminals.js

## Writing tests

Here's modified slides from an internal talk I gave on testing.

#### example code

Suppose you want to click login, enter email & password, click submit, then check you logged in.

admc/wd provides a node-style callback-passing API by default:

    // b is for browser.
    b.get(someUrl, function(err) {
      b.elementByCss('.login', function(err, el) {
        b.clickElement(el, function(err) {
          b.elementByCss('#email', function(err, el) {
            b.type(el, 'foo@bar.com', function(err) { 
              b.elementByCss('#password', function(err, el) {
                b.type(el, 's3cret', function(err) {
                  b.elementByCss('button.submit', function(err, el) {
                    b.click(el, function(err) {
                      b.elementByCss('.logged-in', function(err, el) {
                        b.text(el, function(err, text) {
                          assert.equal(text, 'foo@bar.com');
                        });
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
      
admc/wd also provides a chainable syntax:
    
    b.chain()
      .get(someUrl)
      .elementByCss('.login', function(err, el) {
        b.clickElement(el, errCheck);
       })
      .elementByCss('#email', function(err, el) {
        b.type(el, 'foo@bar.com', errCheck);
       })
      .elementByCss('#password', function(err, el) {
        b.type(el, 's3cret', errCheck);
       })
      .elementByCss('button.submit', function(err, el) {
        b.click(el errCheck);
       })
      .elementByCss('.logged-in', function(err, el) {
        b.text(el, function(err, text) {
          assert.equal(text, 'foo@bar.com');
        });
      });
      
we've added a super-sugary wrapper API which makes this moar fun:

    b.chain()
      .get(someUrl)
      .wclick('.login')
      .wtype('#email', 'foo@bar.com')
      .wtype('#password', 's3cret')
      .wclick('button.submit')
      .wtext('.logged-in', function(err, text) { 
        assert.equal(text, 'foo@bar.com');
      });
      


#### waiting is hard.

- selenium goes at full speed by default 
  - way faster than any human could click
- implicit wait: in the DOM yet?
  - provided for us
- explicit wait: in the DOM *and visible/active* yet?
  - we have to do the polling
  - wfind(), wclick(), wtype(), wtext(), wwin()


#### writing tests: code organization
  - tests live inside the automation_tests directory for now
  - we are using vows, behind a wrapper that reduces vows' verbosity. (lib/vowsHarness.js)
    - see lloyd/meh/blob/master/new_user_secondary_test.js for vows unwrapped. it is horrible
  - we have the selectors and page functions in the pages directory
  - we have the list of URLs in one file (lib/persona_urls.js)
  - we extract duplication per page/site, a very lightweight version of POM concept (lib/dialog.js)
    - a little abstraction goes a long way. let's keep it light (for now) and seek structure as pain arises, not before.

## Writing tests: Test Setup

* To get common test fixtures (personatestusers, restmail emails, eyedee.me emails, or browser sessions), use TestSetup.setup:

    testSetup.setup({ browsers: 2, restmails: 1, eyedeemails: 1, personatestusers: 2 }, cb)

* You can also use a less verbose syntax:

    testSetup.setup({b:2, r:1, e:1, p:2}, cb)

* Your callback should take an error function and an object that holds all the test fixtures you asked for:

      function(err, fixtures) {
        browser = fixtures.browsers[0];
        secondBrowser = fixtures.browsers[1];
        theEmail = fixtures.restmails[0];
        eyedeemail = fixtures.eyedeemails[0];
        firstUser = fixtures.personatestusers[0];
        secondUser = fixtures.personatestusers[1];
      }

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

#### other extensions (less useful, just documenting 'em in one place)

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
* The sauce links go to a page with the video, the JSON wire session, and the 
raw log.
* Watch the video, for starters.
* After a while, you'll learn to read the commands fired in the session.
* What's tricky is that Selenium generally dies trying to find the next thing,
* so you have to look at the previous element to see what didn't appear, or didn't get clicked, or didn't respond soon enough.
* The raw log contains java exceptions thrown by the selenium server; if weird
errors or timeouts after 300 sec occur, you'll see better diagnostics here.
* Note that the raw log just refers to, say, "element 10". The main page actually shows what the CSS selector was for element 10.

#### 5. Write down WTF happened; I use github gists usually.

#### 6. Classify your failures by type, file bugs, fix 'em

## Refs

* [admc/wd](https://github.com/admc/wd) is our webdriver library
* WebDriver's [JSON wire protocol](http://code.google.com/p/selenium/wiki/JsonWireProtocol#/session/:sessionId/timeouts/implicit_wait) is what lives under the language bindings
* Currently open testing bugs are filed against [mozilla/browserid](https://github.com/mozilla/browserid)
