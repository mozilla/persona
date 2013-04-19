/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

BrowserID.PageHelpers = (function() {
  "use strict";

  var win = window,
      doc = win.document,
      bid = BrowserID,
      storage = bid.Storage,
      user = bid.User,
      helpers = bid.Helpers,
      dom = bid.DOM,
      ANIMATION_SPEED = 250,
      origStoredEmail,
      origin = "https://login.persona.org",
      storageKey = "sign_in_email";

  function getParameterByName( name ) {
    name = name.replace(/[\[]/,"\\[").replace(/[\]]/,"\\]");
    var regexS = "[\\?&]"+name+"=([^&#]*)";
    var regex = new RegExp( regexS );
    var results = regex.exec( doc.location.href );
    if( results === null )
      return "";
    else
      return decodeURIComponent(results[1].replace(/\+/g, " "));
  }

  function showFailure(error, info, callback) {
    info = $.extend(info || {}, { action: error, dialog: false });
    bid.Screens.error.show("error", info);
    callback && callback(false);
  }

  function getFailure(error, callback) {
    return function onFailure(info) {
      showFailure(error, info, callback);
    };
  }

  function replaceFormWithNotice(selector, onComplete) {
    $("form").hide();
    $(selector).fadeIn(ANIMATION_SPEED).promise().done(onComplete);
  }

  return {
    init: function(config) {
      win = config.window || window;
      doc = win.document;
    },
    reset: function() {
      win = window;
      doc = win.document;
    },
    getParameterByName: getParameterByName,
    /**
     * shows a failure screen immediately
     * @method showFailure
     */
    showFailure: showFailure,
    /**
     * get a function to show an error screen when function is called.
     * @method getFailure
     */
    getFailure: getFailure,
    replaceFormWithNotice: replaceFormWithNotice,
    cancelEvent: helpers.cancelEvent
  };
}());
