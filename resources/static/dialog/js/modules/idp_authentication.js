/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
BrowserID.Modules.IdPAuthentication= (function() {
  "use strict";

  var bid = BrowserID,
      helpers = bid.Helpers,
      user = bid.User,
      dom = bid.DOM,
      network = bid.Network,
      path = document.location.pathname || "/",
      mediator = bid.Mediator,
      dialogHelpers = bid.Helpers.Dialog,
      moduleManager = bid.module,
      modules = bid.Modules,
      CookieCheck = modules.CookieCheck,
      XHRDelay = modules.XHRDelay,
      XHRDisableForm = modules.XHRDisableForm,
      Development = modules.Development,
      ANIMATION_TIME = 500,
      sc;

  var Module = bid.Modules.PageModule.extend({
    start: function(options) {
      options = options || {};

      window.resizeTo(700, 440); // Gross

      navigator.id.beginAuthentication(function(email) {
	mediator.subscribe("authentication_success", function(msg, info) {
          // TODO: Are we sure that we authed as email?
          navigator.id.completeAuthentication();
	});

	mediator.subscribe("new_user", function(msg, info) {
          var email = info.email;
          // TODO: Are we sure that we authed as email?
          moduleManager.start("set_password", info);
          mediator.subscribe("password_set", function(msg, info) {

	    // TODO merge broke us - user.setRPInfo must now be called like in 
	    // resources/static/dialog/js/modules/dialog.js line 130, 286
	    //      params.origin = user.getOrigin();
	    var rpInfo = bid.Models.RpInfo.create({origin: 'http://192.168.186.138:10001'});
	    user.setRpInfo(rpInfo);


            dialogHelpers.createUser.call({
              getErrorDialog: function(a, b, c) {
		// TODO: Use or remove
		//console.log('getErrorDialog called', a, b, c);
              },
              publish: function(msg, info) {
		if ('user_staged') {

                  info.siteName = 'TODO';
                  info.verifier = "waitForUserValidation";
                  info.verificationMessage = "user_confirmed";

                  moduleManager.start("check_registration", info);
                  user.waitForUserValidation(info.email, function(msg) {
                    if ('complete' === msg &&
			email === info.email) {
                      navigator.id.completeAuthentication();
                    } else {
                      // TODO Handle error ?
                    }
                  },
					     function(a, b, c) {
					       // TODO: Handle
					       //console.log('ERROR', a, b, c);
					     });
                  
                  mediator.subscribe("user_confirmed", function(a, b, c) {
                    // TODO: use or remove
                    //console.log('user_confirmed', a, b, c);
                  });
		}
              }
            }, email, info.password, function(a, b, c) {
              // TODO handle
              //console.log(a, b, c);
            });
          });
	});
	moduleManager.start("authenticate", {
          email: email
	});
	//$('#authentication_email').val(email);
	$('button:visible').click();//Gross

      });
      // end aok
    },

    stop: function() {
      sc.stop.call(this);
    }

    // BEGIN TESTING API
    ,

    // END TESTING API
  });

  sc = Module.sc;

  return Module;
}());
