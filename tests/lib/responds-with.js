/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const assert            = require('assert'),
      http              = require('http'),
      wsapi             = require('./wsapi.js');

// Taken from the vows page.
function assertStatus(code) {
  return function (err, res) {
    assert.equal(res.code, code);
  };
}

module.exports = function(status, done) {
  var context = {
    topic: function () {
      // Get the current context's name, such as "POST /"
      // and split it at the space.
      var req    = this.context.name.split(/ +/), // ["POST", "/"]
          method = req[0].toLowerCase(),         // "post"
          path   = req[1];                       // "/"

      // Perform the contextual client request,
      // with the above method and path. If done is not passed in,
      // this.callback will be called automatically.
      wsapi[method](path, null, null, done).call(this);
    }
  };

  // Create and assign the vow to the context.
  // The description is generated from the expected status code
  // and the status name, from node's http module.
  context['should respond with a ' + status + ' '
         + http.STATUS_CODES[status]] = assertStatus(status);

  return context;
};


