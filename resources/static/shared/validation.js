/*globals BrowserID: true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
BrowserID.Validation = (function() {
  var bid = BrowserID,
      tooltip = bid.Tooltip;

  bid.verifyEmail = function(address) {
    if (typeof(address) !== "string")
      return false;
    // Original gotten from http://blog.gerv.net/2011/05/html5_email_address_regexp/
    // changed the requirement that there must be a ldh-str because BrowserID
    // is only used on internet based networks.
    var parts = address.split("@");

    return /^[\w.!#$%&'*+\-/=?\^`{|}~]+@[a-z\d-]+(\.[a-z\d-]+)+$/i.test(address)
           // total address allwed to be 254 bytes long
           && address.length <= 254
           // local side only allowed to be 64 bytes long
           && parts[0] && parts[0].length <= 64
           // domain side allowed to be up to 253 bytes long
           && parts[1] && parts[1].length <= 253;
  };


  function validateEmail(email) {
    var valid = false;

    if (!email) {
      tooltip.showTooltip("#email_required");
    }
    else if (!bid.verifyEmail(email)) {
      tooltip.showTooltip("#email_format");
    }
    else {
      valid = true;
    }

    return valid;
  }

  function validateEmailAndPassword(email, password) {
    var valid = validateEmail(email);

    if (valid) {
      valid = passwordExists(password);
    }

    return valid;
  }

  function passwordExists(password) {
    var valid = !!password;

    if (!valid) {
      tooltip.showTooltip("#password_required");
    }

    return valid;
  }

  function passwordLength(password) {
    var valid = password && (password.length >= 8 && password.length <= 80);

    if(!valid) {
      tooltip.showTooltip("#password_length");
    }

    return valid;
  }

  function validationPasswordExists(vpass) {
    var valid = !!vpass;

    if(!valid) {
      tooltip.showTooltip("#vpassword_required");
    }

    return valid;
  }

  function passwordAndValidationPassword(pass, vpass) {
    var valid = passwordExists(pass) && passwordLength(pass) && validationPasswordExists(vpass);

    if (valid && pass !== vpass) {
      valid = false;
      tooltip.showTooltip("#passwords_no_match");
    }

    return valid;
  }

  return {
    email: validateEmail,
    password: passwordExists,
    emailAndPassword: validateEmailAndPassword,
    passwordAndValidationPassword: passwordAndValidationPassword
  };

}());

