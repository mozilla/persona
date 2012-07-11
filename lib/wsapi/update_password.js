/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
db = require('../db.js'),
wsapi = require('../wsapi.js'),
httputils = require('../httputils'),
logger = require('../logging.js').logger,
bcrypt = require('../bcrypt');

exports.method = 'post';
exports.writes_db = true;
exports.authed = 'password';
exports.args = {
  oldpass: 'password',
  newpass: 'password'
};
exports.i18n = false;

exports.process = function(req, res) {
  db.checkAuth(req.session.userid, function(err, hash) {
    if (err) return wsapi.databaseDown(res, err);

    if (typeof hash !== 'string' || typeof req.params.oldpass !== 'string')
    {
      return res.json({ success: false });
    }

    bcrypt.compare(req.params.oldpass, hash, function (err, success) {
      if (err) {
        if (err.indexOf('exceeded') != -1) {
          logger.warn("max load hit, failing on auth request with 503: " + err);
          res.status(503);
          return res.json({ success: false, reason: "server is too busy" });
        }
        logger.warn("error comparing passwords with bcrypt: " + err);
        return res.json({ success: false });
      }

      if (!success) {
        logger.info("password update fails, incorrect old password");
        return res.json({ success: false });
      }

      logger.info("updating password for user " + req.session.userid);
      wsapi.bcryptPassword(req.params.newpass, function(err, hash) {
        if (err) {
          if (err.indexOf('exceeded') != -1) {
            logger.warn("max load hit, failing on auth request with 503: " + err);
            res.status(503);
            return res.json({ success: false, reason: "server is too busy" });
          }
          logger.error("error bcrypting password for password update for user " + req.session.userid, err);
          return res.json({ success: false });
        }

        db.updatePassword(req.session.userid, hash, function(err) {
          var success = true;
          if (err) {
            logger.error("error updating bcrypted password for user " + req.session.userid, err);
            wsapi.databaseDown(res, err);
          } else {
            res.json({ success: success });
          }
        });
      });
    });
  });
};
