o hai!

## Getting started

#### Install deps:

    ```npm install```

#### You need the selenium-server-standalone jar to run tests locally:

   ```curl http://selenium.googlecode.com/files/selenium-server-standalone-2.25.0.jar > selenium-server-standalone-2.25.0.jar```

#### Fire up selenium:

    ```java -jar selenium-server-standalone-2.25.0.jar```

#### run some tests locally

There isn't a test runner yet, but you can do this for each test under `tests`:

    PERSONA_ENV=stage node tests/change-password-test.js

`PERSONA_ENV` sets the target you want to test. **stage** is the most stable environment at present, so run your tests against it.

#### run some tests against sauce

Set some more environment variables:

    * specify sauce username as `PERSONA_SAUCE_USER` (in persona-secrets bundle for mozilla identity devs)
    * specify sauce api key as `PERSONA_SAUCE_APIKEY` (in persona-secrets bundle for mozilla identity devs)
    * specify your sauce browser and OS combo as `PERSONA_BROWSER`
        * current list: `linux_firefox_13`, `linux_opera_12`, `osx_firefox_14`, `vista_chrome`, `vista_firefox_13`, `vista_ie_9`, `xp_ie_8`
        * the list is in lib/sauce-platforms.js
    * You can temporarily force a local browser run with `PERSONA_NO_SAUCE`. If you do this, make sure `PERSONA_BROWSER` is set to something that can be run locally.

Then run the tests just like you would locally:

    PERSONA_ENV=stage node tests/change-password-test.js

#### run all the tests
It is possible to run all of the available tests either locally or against
Sauce. The RUNNERS environment variable is used to specify the number of test
runners to run in parallel.

To run all the tests locally against one browser:

    PERSONA_ENV=stage PERSONA_BROWSER=osx_firefox_15 PERSONA_NO_SAUCE=true scripts/run-all.js

To run all the tests on Sauce against one browser:

    PERSONA_ENV=stage RUNNERS=15 PERSONA_BROWSER=osx_firefox_15 scripts/run-all.js

To run all the tests on Sauce against all supported browsers:

    PERSONA_ENV=stage RUNNERS=30 PERSONA_BROWSER=all scripts/run-all.js

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

## Refs

* [admc/wd](https://github.com/admc/wd) is our webdriver library
* WebDriver's [JSON wire protocol](http://code.google.com/p/selenium/wiki/JsonWireProtocol#/session/:sessionId/timeouts/implicit_wait) is what lives under the language bindings
* we keep a list of tests to write in an [etherpad](https://id.etherpad.mozilla.org/test-automation-spec).
