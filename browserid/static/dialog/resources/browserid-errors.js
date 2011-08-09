var BrowserIDErrors = (function(){
  "use strict";

  var Errors = {
    authentication: {
      type: "serverError",
      message: "Error Authenticating",
      description: "There was a technical problem while trying to log you in.  Yucky!"
    },

    addEmail: {
      type: "serverError",
      message: "Error Adding Address",
      description: "There was a technical problem while trying to add this email to your account.  Yucky!"
    },

    checkAuthentication: {
      type: "serverError",
      message: "Error Checking Authentication",
      description: "There was a tenical problem while trying to log you in.  Yucky!"
    },

    createAccount: {
      type: "serverError",
      message: "Error Creating Account",
      description: "There was a technical problem while trying to create your account.  Yucky!"
    },

    registration: {
      type: "serverError",
      message: "Registration Failed",
      description: "An error was encountered and the signup cannot be completed.  Yucky!"
    },

    signIn: {
      type: "serverError",
      message: "Signin Failed",
      description: "There was an error signing in. Yucky!"
    },

    syncAddress: {
      type: "serverError",
      message: "Error Syncing Address",
      description: "There was a technical problem while trying to synchronize your account.  Yucky!"
    }

  };


  return Errors;
}());


