/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
BrowserID.Wait = (function(){
  "use strict";

  var Wait = {
    authentication: {
      title: gettext("Finishing Sign In..."),
      message:  gettext("In just a moment you'll be signed into BrowserID.")
    },

    generateKey: {
      title:  gettext("Finishing Sign In..."),
      message:  gettext("Please wait a few seconds while we sign you into the site.")
    },

    slowXHR: {
      title:  gettext("We are sorry, this request is taking a LOOONG time."),
      message:  gettext("This message will go away when the request completes (hopefully soon). If you wait too long, close this window and try again."),
      id: "slowXHR"
    }

  };


  return Wait;
}());


