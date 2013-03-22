
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

BrowserID.manageAccount = (function() {
  "use strict";

  var bid = BrowserID,
      user = bid.User,
      errors = bid.Errors,
      dom = bid.DOM,
      storage = bid.Storage,
      helpers = bid.Helpers,
      pageHelpers = bid.PageHelpers,
      cancelEvent = pageHelpers.cancelEvent,
      /*globals confirm:true*/
      confirmAction = confirm,
      complete = helpers.complete,
      doc = document,
      tooltip = bid.Tooltip,
      authLevel;

  function syncAndDisplayEmails(oncomplete) {
    /*jshint validthis:true*/
    var self=this;
    user.syncEmails(function() {
      displayStoredEmails.call(self, oncomplete);
    }, pageHelpers.getFailure(errors.syncEmails, oncomplete));
  }

  function displayStoredEmails(oncomplete) {
    /*jshint validthis:true*/
    var emails = user.getSortedEmailKeypairs();
    if (_.isEmpty(emails)) {
      dom.hide("#content");
    } else {
      dom.show("#content");
      dom.hide("#vAlign");
      renderEmails.call(this, emails);
    }
    complete(oncomplete);
  }

  function removeEmail(email, oncomplete) {
    /*jshint validthis:true*/
    var self=this;
    user.syncEmails(function() {
      var emails = user.getStoredEmailKeypairs();
      if (!emails[email]) {
        displayStoredEmails.call(self, oncomplete);
      }
      else if (_.size(emails) > 1) {
        if (confirmAction(format(gettext("Remove %(email)s from your Persona account?"),
                                 { email: email }))) {
          user.removeEmail(email, function() {
            displayStoredEmails.call(self, oncomplete);
          }, pageHelpers.getFailure(errors.removeEmail, oncomplete));
        }
        else {
          complete(oncomplete);
        }
      }
      else {
        if (confirmAction(gettext("Removing the last address will cancel your Persona account.\nAre you sure you want to continue?"))) {
          user.cancelUser(function() {
            doc.location="/";
            complete(oncomplete);
          }, pageHelpers.getFailure(errors.cancelUser, oncomplete));
        }
        else {
          complete(oncomplete);
        }
      }
    }, pageHelpers.getFailure(errors.syncEmails, oncomplete));
  }

  function renderEmails(emails) {
    /*jshint validthis:true*/
    var self=this,
        list = dom.getElements("#emailList");

    dom.setInner(list, "");

    function substitute(text, values, re) {
      re = re || /\{\{([^\{\}]+)\}\}/g;
      return String(text).replace(re, function(m, name) {
        return (values[name] != null) ? values[name] : '';
      });
    }

    var template = dom.getInner("#templateUser");

    _.each(emails, function(item) {
      var e = _.escape(item.address);
      var identity = substitute(template, { email: e });

      var idEl = dom.appendTo(identity, list),
          deleteButton = dom.getDescendentElements(".delete", idEl);

      self.click(deleteButton, removeEmail.curry(e));
    });
  }

  function cancelAccount(oncomplete) {
    if (confirmAction(gettext("Are you sure you want to delete your Persona account?"))) {
      user.cancelUser(function() {
        doc.location="/";
        complete(oncomplete);
      }, pageHelpers.getFailure(errors.cancelUser, oncomplete));
    }
  }

  function startEdit(event) {
    event.preventDefault();
    dom.addClass(dom.closest("section", event.target), "edit");
  }

  function cancelEdit(event) {
    event.preventDefault();
    dom.removeClass(dom.closest("section", event.target), "edit");
  }

  function submit(oncomplete) {
    var oldPassword = dom.getInner("#old_password"),
        newPassword = dom.getInner("#new_password");

    function changePassword() {
      user.changePassword(oldPassword, newPassword, function(status) {
        if(status) {
          // a successful password change always puts the session in a
          // 'password' level authentication
          authLevel = "password";
          dom.removeClass("#edit_password", "edit");
          dom.setInner("#old_password", "");
          dom.setInner("#new_password", "");
        }
        else {
          tooltip.showTooltip("#tooltipInvalidPassword");
        }

        complete(oncomplete, status);
      }, pageHelpers.getFailure(errors.updatePassword, oncomplete));
    }

    if(!oldPassword) {
      tooltip.showTooltip("#tooltipOldRequired");
      complete(oncomplete, false);
    }
    else if(oldPassword.length < bid.PASSWORD_MIN_LENGTH || bid.PASSWORD_MAX_LENGTH < oldPassword.length) {
      // If the old password is out of range, we know it is invalid. Show the
      // tooltip. See issue #2121
      // - https://github.com/mozilla/browserid/issues/2121
      tooltip.showTooltip("#tooltipInvalidPassword");
      complete(oncomplete, false);
    }
    else if(!newPassword) {
      tooltip.showTooltip("#tooltipNewRequired");
      complete(oncomplete, false);
    }
    else if(newPassword === oldPassword) {
      tooltip.showTooltip("#tooltipPasswordsSame");
      complete(oncomplete, false);
    }
    else if(newPassword.length < bid.PASSWORD_MIN_LENGTH || bid.PASSWORD_MAX_LENGTH < newPassword.length) {
      tooltip.showTooltip("#tooltipPasswordLength");
      complete(oncomplete, false);
    }
    else {
      changePassword();
    }
  }


  function displayHelpTextToNewUser() {
    var newUser = !storage.manage_page.get("has_visited_manage_page");

    dom[newUser ? "addClass" : "removeClass"]("body", "newuser");
    storage.manage_page.set("has_visited_manage_page", true);
  }

  function displayChangePassword(oncomplete) {
    user.withContext(function(ctx) {
      dom[ctx.has_password ? "addClass" : "removeClass"]("body", "canSetPassword");
      complete(oncomplete);
    });
  }

  var Module = bid.Modules.PageModule.extend({
    start: function(options) {
      options = options || {};

      if (options.document) doc = options.document;
      if (options.confirm) confirmAction = options.confirm;

      var self=this,
          oncomplete = options.ready,
          manage = dom.getInner("#templateManage");

      dom.insertAfter(manage, "#hAlign");

      self.click("#cancelAccount", cancelAccount);

      self.bind("button.edit", "click", startEdit);
      self.bind("button.done", "click", cancelEdit);

      user.checkAuthentication(function(auth_level) {
        authLevel = auth_level;

        syncAndDisplayEmails.call(self, function() {
          displayHelpTextToNewUser();
          displayChangePassword(oncomplete);
        });
      }, pageHelpers.getFailure(errors.checkAuthentication, oncomplete));

      Module.sc.start.call(self, options);
    },

    submit: submit

    // BEGIN TESTING API
    ,
    cancelAccount: cancelAccount,
    removeEmail: removeEmail,
    changePassword: submit
    // END TESTING API
  });


  return Module;

}());



