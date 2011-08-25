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

$(function() {
  if ($('#emailList')) {
    display_saved_ids();
  }
});

var csrf = undefined;
// execute a function with a csrf token, fetching it if required
function withCSRF(cb) {
  if (csrf === undefined) {
    $.get("/wsapi/csrf", {}, function(result) {
      csrf = result;
      cb();
    }, 'html');
  } else {
    setTimeout(cb, 0);
  }
}


function display_saved_ids()
{
  var emails = {};
  if (window.localStorage.emails) {
    emails = JSON.parse(window.localStorage.emails);
  }

  $('#cancellink').click(function() {
    if (confirm('Are you sure you want to cancel your account?')) {
      withCSRF(function() {
        $.post("/wsapi/account_cancel", {"csrf": csrf}, function(result) {
          window.localStorage.emails = null;
          document.location="/";
        });
      });
    }
  });

  $("#emailList").empty();
  _(emails).each(function(data, e) {
      var block = $("<div>").addClass("emailblock");
      var label = $("<div>").addClass("email").text(e);
      var meta = $("<div>").addClass("meta");

      /* 
        var priv = $("<div class='keyblock'>").text(data.priv);
        priv.hide();
       */

      var pub = $("<div class='keyblock'>").text(data.pub);
      pub.hide();
      var linkblock = $("<div>");
      var puba = $("<a>").text("[show public key]");
      // var priva = $("<a>").text("[show private key]");
      puba.click(function() {pub.show()});
      // priva.click(function() {priv.show()});
      linkblock.append(puba);
      // linkblock.append(" / ");
      // linkblock.append(priva);
      
      var deauth = $("<button>").text("Forget this Email");
      meta.append(deauth);
      deauth.click(function() {
        var t = JSON.parse(window.localStorage.emails);
        withCSRF(function() {
          // remove email from server
          $.post("/wsapi/remove_email", {"email" : e, "csrf": csrf}, function(response) {
            // we delete from store only once we got response
            delete t[e];
            window.localStorage.emails = JSON.stringify(t);
            display_saved_ids();
          });
        });
      });
      
      var d = new Date(data.created);
      var datestamp = $("<div class='date'>").text("Signed in at " + d.getHours() + ":" + d.getMinutes() + ":" + d.getSeconds() + ", " + d.getMonth() + "/" + d.getDay() + "/" + d.getUTCFullYear());

      meta.append(datestamp);
      meta.append(linkblock);
                  
      block.append(label);
      block.append(meta);
      // block.append(priv);
      block.append(pub);
      
      $("#emailList").append(block);
  });
}
