const
db = require('../db.js');

/* First half of account creation.  Stages a user account for creation.
 * this involves creating a secret url that must be delivered to the
 * user via their claimed email address.  Upon timeout expiry OR clickthrough
 * the staged user account transitions to a valid user account
 */

exports.method = 'get';
exports.writes_db = false;
exports.authed = true;
exports.args = ['email'];

exports.process = function(req, res) {
  var email = req.query.email;

  // check if the currently authenticated user has the email stored under pendingAddition
  // in their acct.
  db.emailsBelongToSameAccount(
    email,
    req.session.authenticatedUser,
    function(registered) {
      if (registered) {
        delete req.session.pendingAddition;
        res.json({ status: 'complete' });
      } else if (!req.session.pendingAddition) {
        res.json({ status: 'failed' });
      } else {
        db.haveVerificationSecret(req.session.pendingAddition, function (known) {
          if (known) {
            return res.json({ status: 'pending' });
          } else {
            delete req.session.pendingAddition;
            res.json({ status: 'failed' });
          }
        });
      }
    });
};
