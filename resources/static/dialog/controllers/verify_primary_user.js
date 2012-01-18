/*jshint browser:true, jQuery: true, forin: true, laxbreak:true */
/*global _: true, BrowserID: true, PageController: true */
/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Mozilla BrowserID.
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */
BrowserID.Modules.VerifyPrimaryUser = (function() {
  "use strict";

  var bid = BrowserID,
      sc,
      win,
      add,
      email,
      auth_url,
      helpers = bid.Helpers,
      cancelEvent = helpers.Dialog.cancelEvent;

  function verify(callback) {
    this.publish("primary_user_authenticating");

    // replace any hashes that may be there already.
    var returnTo = win.document.location.href.replace(/#.*$/, "");

    var type = add ? "ADD_EMAIL" : "CREATE_EMAIL";
    var url = helpers.toURL(auth_url, {
      email: email,
      return_to: returnTo + "#" + type + "=" +email
    });

    win.document.location = url;

    callback();
  }

  function cancel(callback) {
    this.close("cancel_state");
    callback && callback();
  }

  var Module = bid.Modules.PageModule.extend({
    start: function(data) {
      var self=this;
      data = data || {};

      win = data.window || window;
      add = data.add;
      email = data.email;
      auth_url = data.auth_url;

      data.requiredEmail = data.requiredEmail || false;
      self.renderDialog("verify_primary_user", data);

      self.bind("#cancel", "click", cancelEvent(cancel));

      sc.start.call(self, data);
    },

    submit: verify

    // BEGIN TESTING API
    ,
    cancel: cancel
    // END TESTING API
  });

  sc = Module.sc;

  return Module;
}());

