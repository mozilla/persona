o hai!

## Getting started

* Install deps:

    npm install

* You need the selenium-server-standalone jar to run tests locally:

   curl http://selenium.googlecode.com/files/selenium-server-standalone-2.25.0.jar > selenium-server-standalone-2.25.0.jar

* Fire up selenium:

    java -jar selenium-server-standalone-2.25.0.jar

* run some tests
* ...
* profit


## Reference: Extensions to wd's API

This code lives in lib/wd-extensions.js

### wait-API: wait, then do X. super useful.

* `wfind(selector, cb(err, el))`: wait until the specified element is displayed, then pass it to cb. Alias for custom extension `waitForDisplayed`.
* `wclick(selector, cb(err))`: wait until the specified element is displayed, then click it
* `wwin(windowName, cb(err))`: wait until the specified window is displayed, then switch to it. Aslias for custom extension `waitForWindow`.
  * calling `wwin()` with no arguments will switch to the main window--not true of `waitForWindow`.
* `wtype(selector, text, cb(err))`: wait until the specified element is displayed, then type into it
  * warning: wd.type() takes an element, not a selector!
* `wtext(selector, cb(err, text))`: wait until the specified element is displayed, then pass its text content to cb

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

## Refs

* [admc/wd](https://github.com/admc/wd) is our webdriver library
* WebDriver's [JSON wire protocol](http://code.google.com/p/selenium/wiki/JsonWireProtocol#/session/:sessionId/timeouts/implicit_wait) is what lives under the language bindings
* we keep a list of tests to write in an [etherpad](https://id.etherpad.mozilla.org/test-automation-spec).
