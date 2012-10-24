/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
BrowserID.Modules.PageModule = (function() {
"use strict";

  /*
   * PageModule provides functionality for screens on
   * either the main site or in the dialog.
   */

  var bid = BrowserID,
      dom = bid.DOM,
      screens = bid.Screens,
      helpers = bid.Helpers,
      cancelEvent = helpers.cancelEvent,
      sc;

   function onSubmit() {
     /*jshint validthis:true*/
     if (!dom.hasClass("body", "submit_disabled") && this.validate()) {
       this.submit();
     }
     return false;
   }

  function showScreen(screen, template, vars, oncomplete) {
    screen.show(template, vars);
    // Fire a window resize event any time a new section is displayed that
    // may change the content's innerHeight.  this will cause the "screen
    // size hacks" to resize the screen appropriately so scroll bars are
    // displayed when needed.
    dom.fireEvent(window, "resize");
    oncomplete && oncomplete();
  }

  function hideScreen(screen) {
    screen.hide();
  }

  var Module = bid.Modules.DOMModule.extend({
    start: function(options) {
      var self=this;

      sc.start.call(self, options);

      self.bind("form", "submit", cancelEvent(onSubmit));
    },

    stop: function() {
      dom.removeClass("body", "waiting");
      sc.stop.call(this);
    },

    renderDialog: function(template, data) {
      var self=this;

      self.hideWait();
      self.hideError();
      self.hideDelay();

      dom.removeClass("body", "rptospp");

      screens.form.show(template, data);
      dom.focus("input:visible:not(:disabled):eq(0)");
      // XXX jQuery.  bleck.
      if($("*:focus").length === 0) {
        dom.focus("button:visible:eq(0)");
      }
    },

    renderWait: showScreen.curry(screens.wait),
    hideWait: hideScreen.curry(screens.wait),

    renderError: showScreen.curry(screens.error),
    hideError: hideScreen.curry(screens.error),

    renderDelay: showScreen.curry(screens.delay),
    hideDelay: hideScreen.curry(screens.delay),

    /**
     * Validate the form, if returns false when called, submit will not be
     * called on click.
     * @method validate.
     */
    validate: function() {
      return true;
    },

    /**
     * Submit the form.  Can be called to force override the
     * disableSubmit function.
     * @method submit
     */
    submit: function() {
    },

    // XXX maybe we should get rid of this.
    close: function(message) {
      this.destroy();
      if (message) {
        this.publish.apply(this, arguments);
      }
    },

    /**
     * Get a curried function to an error dialog.
     * @method getErrorDialog
     * @method {object} action - info to use for the error dialog.  Should have
     * @method {function} [onerror] - callback to call after the
     * error has been displayed.
     * two fields, message, description.
     */
    getErrorDialog: function(action, onerror) {
      var self=this;
      return function(lowLevelInfo) {
        self.renderError("error", $.extend({
          action: action
        }, lowLevelInfo), onerror);
      };
    }

    // BEGIN TESTING API
    ,
    onSubmit: onSubmit
    // END TESTING API
  });

  sc = Module.sc;

  return Module;

}());
