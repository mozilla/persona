/*globals BrowserID:true, _: true, confirm: true, displayEmails: true */
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

BrowserID.manageAccount = (function() {
  "use strict";

  var bid = BrowserID,
      user = bid.User,
      errors = bid.Errors,
      dom = bid.DOM,
      pageHelpers = bid.PageHelpers,
      cancelEvent = pageHelpers.cancelEvent,
      confirmAction = confirm,
      doc = document;

  function relativeDate(date) {
    var diff = (((new Date()).getTime() - date.getTime()) / 1000),
        day_diff = Math.floor(diff / 86400),
        dObj = { "friendly" : date.toLocaleDateString(),
                "additional" : date.toLocaleTimeString(),
                "utc" : date.toUTCString(),
                "locale" : date.toLocaleString() };

    /* some kind of error */
    if (day_diff < 0) {
        dObj.friendly = "in the future!?!";
        return dObj;
    } else if (isNaN(day_diff)) {
        dObj.friendly = dObj.additional = "unknown";
        return dObj;
    }

    if (day_diff === 0) {
        if (diff < 60) {
            dObj.friendly = "just now";
            return dObj;
        }
        if (diff < 120 + 30) { /* 1 minute plus some fuzz */
            dObj.friendly = "a minute ago";
            return dObj;
        }
        if (diff < 3600) {
            dObj.friendly = Math.floor(diff / 60) + " minutes ago";
            return dObj;
        }
        if (diff < (60 * 60) * 2) {
            dObj.friendly = "1 hour ago";
            return dObj;
        }
        if (diff < 24 * 60 * 60) {
            dObj.friendly = Math.floor(diff / 3600) + " hours ago";
            return dObj;
        }
    }
    if (day_diff === 1) {
        dObj.friendly = "yesterday";
        return dObj;
    }
    if (day_diff < 7) {
        dObj.friendly = day_diff + " days ago";
        return dObj;
    }
    if (day_diff < 8) {
        dObj.friendly = "last week";
        return dObj;
    }
    /* for this scope: we want day of week and the date
         plus the month (if different) */
    if (day_diff < 31) {
        dObj.friendly = Math.ceil(day_diff / 7) + " weeks ago";
        return dObj;
    }

    /* for this scope: we want month + date */
    if (day_diff < 62) {
        dObj.friendly = "a month ago";
        return dObj;
    }
    if (day_diff < 365) {
        dObj.friendly = Math.ceil(day_diff / 31) + " months ago";
        return dObj;
    }

    /* for this scope: we want month + year */
    if (day_diff >= 365 && day_diff < 730) {
        dObj.additional = date.toLocaleDateString();
        dObj.friendly = "a year ago";
        return dObj;
    }
    if (day_diff >= 365) {
        dObj.additional = date.toLocaleDateString();
        dObj.friendly = Math.ceil(day_diff / 365) + " years ago";
        return dObj;
    }
    return dObj;
  }

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
      var date = relativeDate(new Date(data.created));

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

  function manageAccounts() {
      $("body").addClass("edit");
  }

  function cancelManage() {
      $("body").removeClass("edit");
  }

  function init(options, oncomplete) {
    options = options || {};

    if (options.document) doc = options.document;
    if (options.confirm) confirmAction = options.confirm;

    dom.bindEvent("#cancelAccount", "click", cancelEvent(cancelAccount));
    dom.bindEvent("#manageAccounts", "click", cancelEvent(manageAccounts));
    dom.bindEvent("#cancelManage", "click", cancelEvent(cancelManage));

    syncAndDisplayEmails(oncomplete);
  }

  // BEGIN TESTING API
  function reset() {
    dom.unbindEvent("#cancelAccount", "click");
    dom.unbindEvent("#manageAccounts", "click");
    dom.unbindEvent("#cancelManage", "click");
  }

  init.reset = reset;
  init.cancelAccount = cancelAccount;
  init.removeEmail = removeEmail;
  // END TESTING API

  return init;

}());



