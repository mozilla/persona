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

var BrowserIDStorage = (function() {
  
  var jwk;
  
  function prepareDeps() {
    if (!jwk) {
      jwk = require("./jwk");
    }
  }

  function storeEmails(emails) {
    window.localStorage.emails = JSON.stringify(emails);
  }

  function clearEmails() {
    storeEmails({});
  }

  function getEmails() {
    try {
      var emails = JSON.parse(window.localStorage.emails);
      if (emails !== null)
        return emails;
    } catch(e) {
    }
    
    // if we had a problem parsing or the emails are null
    clearEmails();
    return {};
  }

  function addEmail(email, obj) {
    var emails = getEmails();
    emails[email] = obj;
    storeEmails(emails);
  }

  function removeEmail(email) {
    var emails = getEmails();
    delete emails[email];
    storeEmails(emails);
  }

  function storeTemporaryKeypair(keypair) {
    window.localStorage.tempKeypair = JSON.stringify({
      publicKey: keypair.publicKey.toSimpleObject(),
      secretKey: keypair.secretKey.toSimpleObject()
    });
  }

  function retrieveTemporaryKeypair() {
    var raw_kp = JSON.parse(window.localStorage.tempKeypair);
    window.localStorage.tempKeypair = null;
    if (raw_kp) {
      prepareDeps();
      var kp = new jwk.KeyPair();
      kp.publicKey = jwk.PublicKey.fromSimpleObject(raw_kp.publicKey);
      kp.secretKey = jwk.SecretKey.fromSimpleObject(raw_kp.secretKey);
      return kp;
    } else {
      return null;
    }
  }

  function setStagedOnBehalfOf(origin) {
    window.localStorage.stagedOnBehalfOf = JSON.stringify({
      at: new Date().toString(),
      origin: origin
    });
  }

  function getStagedOnBehalfOf() {
    var origin;

    try {
      var staged = JSON.parse(window.localStorage.stagedOnBehalfOf);
      
      if (staged) {
        if ((new Date() - new Date(staged.at)) > (5 * 60 * 1000)) throw "stale";
        if (typeof(staged.origin) !== 'string') throw "malformed";
        origin = staged.origin;
      }
    } catch (x) {
      console.log(x);
      delete window.localStorage.stagedOnBehalfOf;
    }

    return origin;
  }

  return {
    getEmails: getEmails,
    addEmail: addEmail,
    removeEmail: removeEmail,
    clearEmails: clearEmails,
    storeTemporaryKeypair: storeTemporaryKeypair,
    retrieveTemporaryKeypair: retrieveTemporaryKeypair,
    setStagedOnBehalfOf: setStagedOnBehalfOf,
    getStagedOnBehalfOf: getStagedOnBehalfOf
  };
}());
