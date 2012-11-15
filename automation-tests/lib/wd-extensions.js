// add helper routines onto wd that make common operations easy to do
// correctly

const wd        = require('wd/lib/webdriver')
      utils     = require('./utils.js'),
      timeouts  = require('./timeouts.js');

function setTimeouts(opts) {
  opts.poll = opts.poll || timeouts.DEFAULT_POLL_MS;
  opts.timeout = opts.timeout || timeouts.DEFAULT_TIMEOUT_MS;
}

// save a handle to the current window so that its existence can be
// checked for later. This is necessary in Firefox because the wd
// driver hangs when querying elements on windows that do not exist.
function updateWindowHandle(browser, handle, cb) {
  if (!cb) {
    cb = handle;
    handle = null;
  }

  if (handle) {
    browser._currentWindow = handle;
    cb(null);
  }
  else {
    browser.windowHandle(function(err, handle) {
      if (err) return cb(err);
      browser._currentWindow = handle;
      cb(null);
    });
  }
}


// wait for a element to become part of the dom and be visible to
// the user.  The element is identified by CSS selector.  options:
//   which: css selector specifying which element
//   poll (optional):
//   timeout (optional)
wd.prototype.waitForDisplayed = function(opts, cb) {
  if (typeof opts === 'string') opts = { which: opts };
  if (!opts.which) throw "css selector required";
  setTimeouts(opts);
  var browser = this;

  utils.waitFor(opts.poll, opts.timeout, function(done) {
    browser.elementByCss(opts.which, function(err, elem) {
      if (err) return done(!err, err + " - " + opts.which, elem);
      browser.displayed(elem, function(err, displayed) {
        done(!err && displayed, err, elem);
      });
    });
  }, cb);
};

// allocate a new browser session and sets implicit wait timeout
wd.prototype.newSession = function(opts, cb) {
  var browser = this;
  if (typeof opts === 'function') {
    cb = opts;
    opts = {};
  }

  browser.init(opts, function(err) {
    if (err) return cb(err);
    // let's set the http timeout at 2x the implicit wait timeout for
    // faster failures. (!300s)
    browser.setHTTPInactivityTimeout(2 * timeouts.DEFAULT_TIMEOUT_MS);
    // note!  the implicit wait timeout is different from other timeouts,
    // it's the amount of time certain wire transactions will wait for
    // procedures like find_element to succeed (we'll actually wait on the
    // *server* side for an element to become visible).  Having this be
    // the same as the global default timeout is interesting.
    browser.setImplicitWaitTimeout(timeouts.DEFAULT_TIMEOUT_MS, function() {
      updateWindowHandle(browser, cb);
    });
  });
};

// wait for a window, specified by name, to become visible and switch to it
//  .waitForWindow(<name>, <cb>)
//  or
//  .waitForWindow(<opts>, <cb>)
//
// If the latter invocation is employed, you can specify .poll and .timeout
// values.
wd.prototype.waitForWindow = function(opts, cb) {
  if (typeof opts === 'string') opts = { name: opts };
  if (!opts.name) throw "waitForWindow missing window `name`";
  var browser = this;

  setTimeouts(opts);
  utils.waitFor(opts.poll, opts.timeout, function(done) {
    browser.window(opts.name, function(err) {
      updateWindowHandle(browser, cb);
    });
  }, cb);
};

// close the currently open browser window and switch to one of the remaining
// open windows (deterministic if you know that exactly two windows are open)
wd.prototype.closeCurrentBrowserWindow = function(cb) {
  var self = this;
  self.close(function(err) {
    if (err) return cb(err);
    self.windowHandles(function(err, data) {
      if (err) return cb(err);
      if (data.length < 1) return cb("no window to switch to!");
      self.window(data[0], cb);
    });
  });
};

// wait for an element, specified by CSS selector, to have a non-empty text value.
//  .waitForWindow(<selector>, <cb>)
//  or
//  .waitForWindow(<opts>, <cb>)

wd.prototype.waitForElementText = function(opts, cb) {
  var self = this;
  if (typeof(opts) === 'string') opts = { which: opts };
  setTimeouts(opts);
  utils.waitFor(opts.poll, opts.timeout, function(done) {
    self.elementByCss(opts.which, function(err, elem) {
      if (err) return done(false, err, elem);
      self.text(elem, function(err, text) {
        done(!err && typeof text === 'string' && text.length, err, text);
      });
    });
  }, cb);
};


// convenience methods
wd.prototype.wfind = wd.prototype.waitForDisplayed;
wd.prototype.find = wd.prototype.elementByCss;

// convenience method to switch windows
//
// if no arguments are passed, switch to the base window--in a diaerror flow,
// this will be the zeroth window in the list of handles.
//
// if arguments are passed in, they are forwarded to waitForWindow.
wd.prototype.wwin = function(opts, cb) {
  var self = this;

  // special case where just the callback was passed: go to the zeroth window
  if (arguments.length === 1 && typeof arguments[0] === 'function') {
    cb = arguments[0];
    self.windowHandles(function(err, handles) {
      if (err) return cb(err);
      var handle=handles[0];
      self.window(handle, function(err) {
        updateWindowHandle(self, handle, cb);
      }); // fire cb whether err is defined or not
    });
  } else {
    self.waitForWindow(opts, cb);
  }
};

// wait for element to be displayed, then click on it.
// optionally accepts waitForDisplayed opts object instead of CSS selector
wd.prototype.wclick = function(opts, cb) {
  var self = this;
  self.waitForDisplayed(opts, function(err, el) {
    if (err) return cb(err);
    self.clickElement(el, cb);
  });
};

wd.prototype.click = function(which, cb) {
  var self = this;
  self.elementByCss(which, function(err, el) {
    if (err) return cb(err);
    self.clickElement(el, cb);
  });
};

// Click a button if it exists. If there is a timeout, no problem.
wd.prototype.wclickIfExists = function(opts, cb) {
  var self=this;
  if (typeof opts === 'string') opts = { which: opts };

  // shorten the timeout if it is not already specified. This only gets clicked
  // if it is available. This may belong in a higher abstraction layer.
  if (!opts.timeout) opts.timeout = 1000;

  // yes, this is janktastic as anything. I am trying to wait until the dialog
  // is closed to see if a window exists.
  setTimeout(function() {
    // check if the current window still exists. Firefox has a problem where if
    // a window is closed when you check for an element's existence, it just
    // hangs. Not ideal.
    self.windowHandles(function(err, handles) {
      if (handles && handles.indexOf(self._currentWindow) > -1) {
        self.wclick(opts, function(err, el) {
          // Some buttons (like the Is this your computer) are only shown after
          // a certain amount of time has elapsed. If the button is in the DOM,
          // great, click it. If not, move on.
          if (err && (err.indexOf('timeout hit') === -1)) {
            cb(err, null);
          }
          else {
            cb(null, el);
          }
        });
      }
      else {
        // either there was an error or the window no longer exists. If there
        // was an error, pass it back, if the window no longer exists, no
        // problem, the element does not exist either.
        cb(err, null);
      }
    });
  }, 15000);
};

wd.prototype.wgetAttribute = function(opts, attribute, cb) {
  var self = this;
  self.waitForDisplayed(opts, function(err, el) {
    if (err) return cb(err);
    self.getAttribute(el, attribute, cb);
  });
};


// wait for an element to be displayed, then type in it.
wd.prototype.wtype = function(opts, text, cb) {
  var self = this;
  self.waitForDisplayed(opts, function(err, el) {
    if (err) return cb(err);
    self.type(el, text, cb);
  });
};

// wait then return visible text for an element
wd.prototype.wtext = function(opts, cb) {
  var self = this;
  self.waitForDisplayed(opts, function(err, el) {
    if (err) return cb(err);
    self.text(el, cb);
  });
};

// delay before the next action
wd.prototype.delay = function(duration, cb) {
  setTimeout(cb, duration);
};

// wait then clear an input element
wd.prototype.wclear = function(opts, cb) {
  var self = this;
  self.waitForDisplayed(opts, function(err, el) {
    if (err) return cb(err);
    self.clear(el, cb);
  });
};
