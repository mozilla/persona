/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
certassertion = require('./certassertion.js'),
config = require('../configuration'),
db = require('../db');

// we require the database to look up the last time we've seen the idps
db.open(config.get('database'), function(err) {
  if (err) {
    process.stderr.write('error opening db:' + err);
    process.exit(1);
    return;
  }
});

process.on('message', function(m) {
  db.onReady(function() {
    try {
      certassertion.verify(
        m.assertion, m.audience, m.forceIssuer, !!m.allowUnverified,
        function(email, audienceFromAssertion, expires, issuer, verified) {
          var data = {
            success: {
              audience: audienceFromAssertion,
              expires: expires,
              issuer: issuer
            }
          };
          verified ? data.success.email = email : data.success['unverified-email'] = email;
          process.send(data);
        },
        function(error) {
          process.send({error: error});
        });
    } catch(e) {
      process.send({error: e.toString()});
    }
  });
});
process.on('exit', function() {
  db.close();
});
