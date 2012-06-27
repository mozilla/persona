/*globals BrowserID: true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

BrowserID.Mediator = (function() {
  var hub = Hub;

  return {
    subscribeAll: hub.all.bind(hub),
    subscribe: hub.on.bind(hub),
    unsubscribe: hub.off.bind(hub),
    publish: hub.fire.bind(hub),
    reset: hub.reset.bind(hub)
  };
}());
