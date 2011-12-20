/*jshint browsers:true, forin: true, laxbreak: true */
/*global BrowserID: true, _: true */
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
BrowserID.Provisioning = (function() {
  "use strict";

  var Provisioning = function(args, successCB, failureCB) {
    function fail(code, msg) {
      return setTimeout(function() {
        failureCB({
          code: code,
          msg: msg
        });
      }, 0);
    }

    if (!failureCB) throw "missing required failure callback";

    if (!args || !args.email || !args.url) {
      return fail('internal', 'missing required arguments');
    }

    // extract the expected origin from the provisioning url
    // (this may be a different domain than the email domain part, if the
    //  domain delates authority)
    try {
      var origin = /^(https:\/\/[^/]+)\//.exec(args.url)[1];
    } catch(e) { alert(e); }
    if (!origin) {
      return fail('internal', 'bad provisioning url, can\'t extract origin');
    }

    // time to attempt to provision the user.  we'll embed a hidden iframe from the
    // primary
    var iframe = document.createElement("iframe");
    iframe.setAttribute('src', args.url);
    iframe.style.display = "none";
    document.body.appendChild(iframe);

    var chan = Channel.build({
      window: iframe.contentWindow,
      origin: origin,
      scope: "vep_prov"
    });

    // XXX: register handlers for different messages that the provisioning iframe will send


    // XXX: set a timeout for the amount of time that provisioning is allowed to take
  };

  return Provisioning;
}());