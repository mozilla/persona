/*globals BrowserIDNetwork: true, BrowserIDIdentities: true, _: true, confirm: true, getEmails: true, display_saved_ids: true, removeEmail: true*/
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
(function() {
  "use strict";

  $(function() {
    BrowserIDIdentities.checkAuthenticationAndSync(function onSuccess(authenticated) {
      if (authenticated) {
        $("body").addClass("authenticated");
      }
    }, function onComplete(authenticated) {
      if (authenticated && $('#emailList').length) {
        display_saved_ids();
      } 
    });
  });

  function display_saved_ids()
  {
    $('#cancellink').click(function() {
      if (confirm('Are you sure you want to cancel your account?')) {
        BrowserIDIdentities.cancelUser(function() {
          document.location="/";
        });
      }
    });

    $("#emailList").empty();
    var emails = BrowserIDIdentities.getStoredIdentities();
    _(emails).each(function(data, e) {
      var block = $("<div>").addClass("emailblock");
      var label = $("<div>").addClass("email").text(e);
      var meta = $("<div>").addClass("meta");

      var pub = $("<div class='keyblock'>").hide();
      
      var keyText = data.pub.value;
      pub.text(keyText);

      var linkblock = $("<div>");
      var puba = $("<a>").text("[show public key]");
      // var priva = $("<a>").text("[show private key]");
      puba.click(function() {pub.show();});
      // priva.click(function() {priv.show()});
      linkblock.append(puba);
      // linkblock.append(" / ");
      // linkblock.append(priva);
      
      var deauth = $("<button>").text("Forget this Email");
      meta.append(deauth);
      deauth.click(function(data) {
        // If it is a primary, we do not have to go back to the server.
        // XXX put this into the BrowserIDIdentities abstraction
        if (data.isPrimary) {
          BrowserIDStorage.removeEmail(e);
          display_saved_ids();
        }
        else {
          // remove email from server
          BrowserIDIdentities.removeIdentity(e, display_saved_ids);
        }
      }.bind(null, data));
    
      var d = new Date(data.created);
      var datestamp = $("<div class='date'>").text("Signed in at " + d.toLocaleString());

      meta.append(datestamp);
      meta.append(linkblock);
                  
      block.append(label);
      block.append(meta);
      // block.append(priv);
      block.append(pub);
      
      $("#emailList").append(block);
    });
  }
}());
