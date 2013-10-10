/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function StatsdMock() {
}

StatsdMock.prototype = {
  increment: function(counterName, info) {
    this.lastIncrement = counterName;
    this.lastIncrementInfo = info;
  },
  timing: function(counterName, info, moreInfo) {
    this.lastTiming = counterName;
    this.lastTimingInfo = info;
  }
};

module.exports = StatsdMock;

