/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const bcrypt = require('bcrypt');

process.on('message', function(m) {
  if (m.op === 'encrypt') {
    var r = bcrypt.hashSync(m.pass, bcrypt.genSaltSync(m.factor));
    process.send({r:r});
  } else if (m.op === 'compare') {
    var r = bcrypt.compareSync(m.pass, m.hash);
    process.send({r:r});
  }
});
