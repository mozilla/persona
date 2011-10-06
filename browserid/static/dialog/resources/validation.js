/*globals BrowserID: true */
BrowserID.Validation = (function() {
  var bid = BrowserID,
      tooltip = bid.Tooltip;

  bid.verifyEmail = function(address) {
    // gotten from http://blog.gerv.net/2011/05/html5_email_address_regexp/
    // changed the requirement that there must be a ldh-str because BrowserID 
    // is only used on internet based networks.
    return /^[\w.!#$%&'*+\-/=?\^`{|}~]+@[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(address);
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
    var valid = password && (password.length >= 8);

    if(!valid) {
      tooltip.showTooltip("#password_too_short");
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
    emailAndPassword: validateEmailAndPassword,
    passwordAndValidationPassword: passwordAndValidationPassword
  };
  
}());

