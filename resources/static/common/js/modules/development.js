/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

BrowserID.Modules.Development = (function() {
  "use strict";

  var bid = BrowserID,
      dom = bid.DOM,
      renderer = bid.Renderer,
      storage = bid.Storage,
      user = bid.User,
      clickCount = 0;


  function onDevelopmentClick(event) {
    /*jshint validthis:true*/
    clickCount++;


    if(clickCount === 4) {
      if(!document.getElementById("development")) {
        renderer.append("body", "development", {});
        this.click("#showError", showError);
        this.click("#showDelay", showDelay);
        this.click("#showWait", showWait);
        this.click("#showLoad", showLoad);
        this.click("#hideAll,footer,#errorBackground", hideScreens);
        this.click("#clearLocalStorage", clearLocalStorage);
        this.click("#clearEmailsForSites", clearEmailsForSites);
        this.click("#forceIsThisYourComputer", forceIsThisYourComputer);
        this.click("#redirectTo", redirectTo);
        this.click("#closeDevelopment", close);
      }

      dom.addClass("body", "development");
    }
  }

  function showError() {
    /*jshint validthis:true*/
    this.renderError("error", {
      action: {
        title: "Error title",
        message: "This is an error message"
      },
      network: {
        type: "GET",
        url: "fakeURL"
      }
    });
  }

  function showDelay() {
    /*jshint validthis:true*/
    this.renderDelay("load", {
      title: "Delay Screen",
      message: "Delay Message"
    });
  }

  function showWait() {
    /*jshint validthis:true*/
    this.renderWait("wait", {
      title: "Wait Screen",
      message: "Wait Message"
    });
  }

  function showLoad() {
    /*jshint validthis:true*/
    this.renderLoad("load", {
      title: "Load Screen",
      message: "Load Message"
    });
  }

  function hideScreens() {
    /*jshint validthis:true*/
    this.hideError();
    this.hideDelay();
    this.hideWait();
    this.hideLoad();
  }

  function clearLocalStorage() {
    for(var key in localStorage) {
      localStorage.removeItem(key);
    }
  }

  function clearEmailsForSites() {
    localStorage.removeItem("siteInfo");
  }

  function forceIsThisYourComputer() {
    storage.usersComputer.forceAsk(user.userid());
  }

  function redirectTo() {
    var href = dom.getInner("#siteToRedirectTo");

    if (href) {
      bid.module.stopAll();
      document.location = href;
    }
  }

  function close() {
    dom.removeClass("body", "development");
    clickCount = 0;
  }

  var Module = bid.Modules.PageModule.extend({
    start: function(config) {
      this.click("#showDevelopment", onDevelopmentClick);
    }
  });

  return Module;
}());

