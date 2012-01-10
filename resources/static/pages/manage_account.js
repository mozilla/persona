/*globals BrowserID:true, _: true, confirm: true, displayEmails: true */
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
      confirmAction = confirm,
      doc = document,
      tooltip = bid.Tooltip;

  function syncAndDisplayEmails(oncomplete) {
    user.syncEmails(function() {
      displayStoredEmails(oncomplete);
    }, pageHelpers.getFailure(errors.syncEmails, oncomplete));
  }

  function displayStoredEmails(oncomplete) {
    var emails = user.getStoredEmailKeypairs();
    if (_.isEmpty(emails)) {
      $("#content").hide();
    } else {
      $("#content").show();
      $("#vAlign").hide();
      displayEmails(emails);
    }
    oncomplete && oncomplete();
  }

  function removeEmail(email, oncomplete) {
    var emails = user.getStoredEmailKeypairs();

    function complete() {
      oncomplete && oncomplete();
    }

    if (_.size(emails) > 1) {
      if (confirmAction("Remove " + email + " from your BrowserID?")) {
        user.removeEmail(email, function() {
          displayStoredEmails(oncomplete);
        }, pageHelpers.getFailure(errors.removeEmail, oncomplete));
      }
      else {
        complete();
      }
    }
    else {
      if (confirmAction("Removing the last address will cancel your BrowserID account.\nAre you sure you want to continue?")) {
        user.cancelUser(function() {
          doc.location="/";
          complete();
        }, pageHelpers.getFailure(errors.cancelUser, oncomplete));
      }
      else {
        complete();
      }
    }
  }

  function displayEmails(emails) {
    var list = $("#emailList").empty();

    // Set up to use mustache style templating, the normal Django style blows
    // up the node templates
    _.templateSettings = {
        interpolate : /\{\{(.+?)\}\}/g
    };
    var template = $("#templateUser").html();

    _(emails).each(function(data, e) {
      var date = helpers.relativeDate(new Date(data.created));

      var identity = _.template(template, {
        email: e,
        relative: date.friendly,
        created: date.locale
      });

      var idEl = $(identity).appendTo(list);
      idEl.find(".delete").click(cancelEvent(removeEmail.bind(null, e)));
    });
  }

  function cancelAccount(oncomplete) {
    if (confirmAction("Are you sure you want to cancel your BrowserID account?")) {
      user.cancelUser(function() {
        doc.location="/";
        oncomplete && oncomplete();
      }, pageHelpers.getFailure(errors.cancelUser, oncomplete));
    }
  }

  function startEdit(event) {
    // XXX add some helpers in the dom library to find section.
    event.preventDefault();
    $(event.target).closest("section").addClass("edit");
  }

  function cancelEdit(event) {
    event.preventDefault();
    $(event.target).closest("section").removeClass("edit");
  }

  function changePassword(oncomplete) {
    var oldPassword = dom.getInner("#old_password"),
        newPassword = dom.getInner("#new_password");

    function complete(status) {
      typeof oncomplete == "function" && oncomplete(status);
    }

    if(!oldPassword) {
      tooltip.showTooltip("#tooltipOldRequired");
      complete(false);
    }
    else if(!newPassword) {
      tooltip.showTooltip("#tooltipNewRequired");
      complete(false);
    }
    else if(newPassword.length < 8 || 80 < newPassword.length) {
      tooltip.showTooltip("tooltipPasswordLength");
      complete(false);
    }
    else {
      user.changePassword(oldPassword, newPassword, function(status) {
        if(status) {
          dom.removeClass("#edit_password", "edit");
        }
        else {
          tooltip.showTooltip("#tooltipInvalidPassword");
        }

        complete(status);
      }, pageHelpers.getFailure(errors.updatePassword, oncomplete));
    }

  }

  function displayHelpTextToNewUser() {
    var newUser = !storage.manage_page.get("has_visited_manage_page");

    dom[newUser ? "addClass" : "removeClass"]("body", "newuser");
    storage.manage_page.set("has_visited_manage_page", true);
  }

  function displayChangePassword(oncomplete) {
    user.canSetPassword(function(canSetPassword) {
      dom[canSetPassword ? "addClass" : "removeClass"]("body", "canSetPassword");
      oncomplete && oncomplete();
    }, pageHelpers.getFailure(errors.hasSecondary));
  }

  function init(options, oncomplete) {
    options = options || {};

    if (options.document) doc = options.document;
    if (options.confirm) confirmAction = options.confirm;

    dom.bindEvent("#cancelAccount", "click", cancelEvent(cancelAccount));

    dom.bindEvent("button.edit", "click", startEdit);
    dom.bindEvent("button.done", "click", cancelEdit);
    dom.bindEvent("#edit_password_form", "submit", cancelEvent(changePassword));

    syncAndDisplayEmails(function() {
      displayHelpTextToNewUser();
      displayChangePassword(oncomplete);
    });
  }

  // BEGIN TESTING API
  function reset() {
    dom.unbindEvent("#cancelAccount", "click");

    dom.unbindEvent("button.edit", "click");
    dom.unbindEvent("button.done", "click");
    dom.unbindEvent("#edit_password_form", "submit");
  }

  init.reset = reset;
  init.cancelAccount = cancelAccount;
  init.removeEmail = removeEmail;
  init.changePassword = changePassword;
  // END TESTING API

  return init;

}());



