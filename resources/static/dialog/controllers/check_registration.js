/*jshint browser:true, jQuery: true, forin: true, laxbreak:true */
/*global BrowserID: true, PageController: true */
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
BrowserID.Modules.CheckRegistration = (function() {
  "use strict";

  var bid = BrowserID,
      user = bid.User,
      dom = bid.DOM,
      errors = bid.Errors;

  var CheckRegistration = bid.Modules.PageModule.extend({
    start: function(options) {
      var self=this;
      self.renderWait("confirm_email", {
          email: options.email
      });
      self.email = options.email;
      self.verifier = options.verifier;
      self.verificationMessage = options.verificationMessage;

      self.bind("#back", "click", self.cancel);

      CheckRegistration.sc.start.call(self, options);
    },

    startCheck: function(oncomplete) {
      var self=this;
      user[self.verifier](self.email, function(status) {
        if (status === "complete") {
          user.syncEmails(function() {
            self.close(self.verificationMessage);
            oncomplete && oncomplete();
          });
        }
        else if (status === "mustAuth") {
          self.close("auth", { email: self.email });
          oncomplete && oncomplete();
        }
      }, self.getErrorDialog(errors.registration, oncomplete));
    },

    cancel: function() {
      var self=this;
      // XXX this should change to cancelEmailValidation for email, but this
      // will work.
      user.cancelUserValidation();
      self.close("cancel_state");
    }

  });

  return CheckRegistration;

}());
