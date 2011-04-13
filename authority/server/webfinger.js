const db = require('./db.js');

const HEADER = "<?xml version='1.0' encoding='UTF-8'?>\n<XRD xmlns='http://docs.oasis-open.org/ns/xri/xrd-1.0'\n     xmlns:hm='http://host-meta.net/xrd/1.0'>\n";

const FOOTER ="</XRD>\n";
const KEYHEADER = "  <Link rel=\"public-key\" value=\"";
const KEYFOOTER = "\"/>\n";

exports.renderUserPage = function(identity, cb) {
  db.pubkeysForEmail(identity, function(keys) {
    var respDoc = undefined;
    if (keys && keys.length) {
      respDoc = HEADER;
      for (var i = 0; i < keys.length; i++) {
        respDoc += (KEYHEADER + keys[i] + KEYFOOTER) ;
      }
      respDoc += FOOTER;
    }
    cb(respDoc);
  });
};