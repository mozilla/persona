const bcrypt = require('bcrypt');

process.on('message', function(m) {
  if (m.op === 'encrypt') {
    var r = bcrypt.encrypt_sync(m.pass, bcrypt.gen_salt_sync(m.factor));
    process.send({r:r});
  } else if (m.op === 'compare') {
    var r = bcrypt.compare_sync(m.pass, m.hash);
    process.send({r:r});
  }
});
