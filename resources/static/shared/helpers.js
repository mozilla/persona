/*globals BrowserID: true */
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
  "use strict"

  var bid = BrowserID,
      dom = bid.DOM,
      validation = bid.Validation,
      helpers = bid.Helpers = bid.Helpers || {};

  function extend(target, source) {
    for(var key in source) {
      target[key] = source[key];
    }
  };

  function getAndValidateEmail(target) {
    var email = (dom.getInner(target) || "").trim();

    if(!validation.email(email)) return null;

    return email;
  }

  function getAndValidatePassword(target) {
    var password = (dom.getInner(target) || "");

    if(!validation.password(password)) return null;

    return password;
  }

  extend(helpers, {
    /**
     * Extend an object with the properties of another object.  Overwrites 
     * properties if they already exist.
     * @method extend
     * @param {object} target
     * @param {object} source
     */
    extend: extend,

    /**
     * Get an email from a DOM element and validate it.
     * @method getAndValidateEmail
     * @param {string} target - target containing the email
     * @return {string} email if email is valid, null otw.
     */
    getAndValidateEmail: getAndValidateEmail,

    /**
     * Get an password from a DOM element and validate it.
     * @method getAndValidatePassword
     * @param {string} target - target containing the password
     * @return {string} password if password is valid, null otw.
     */
    getAndValidatePassword: getAndValidatePassword,
  });


}());

