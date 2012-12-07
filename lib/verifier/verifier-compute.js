/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
certassertion = require('./certassertion.js');

process.on('message', function(m) {
  try {
    certassertion.verify(
      m.assertion, m.audience, m.forceIssuer, !!m.allowUnverified,
      function(email, audienceFromAssertion, expires, issuer) {
        process.send({
          success: {
            email: email,
            audience: audienceFromAssertion,
            expires: expires,
            issuer: issuer
          }
        });
      },
      function(error) {
        process.send({error: error});
      });
  } catch(e) {
    process.send({error: e.toString()});
  }
});
