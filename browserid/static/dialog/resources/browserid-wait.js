var BrowserIDWait = (function(){
  "use strict";

  var Wait = {
    authentication: {
      message: "Finishing Sign In...",
      description: "In just a moment you'll be signed into BrowserID."
    },

    addEmail: {
      message: "One Moment Please...",
      description: "We're adding this email to your account, this should only take a couple of seconds."
    },

    checkAuth: {
      message: "Communicating with server",
      description: "Just a moment while we talk with the server."
    },

    createAccount: {
      message: "One Moment Please...",
      description: "We're creating your account, this should only take a couple of seconds."
    }
  };


  return Wait;
}());


