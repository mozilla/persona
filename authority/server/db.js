// Registered users.  This is a horribly inefficient data structure
// which only exists for prototype purposes.
var g_users = [
];

// half created user accounts (pending email verification)
// OR
// half added emails (pending verification)
var g_staged = {
};

exports.findByEmail = function(email) {
  for (var i = 0; i < g_users.length; i++) {
    for (var j = 0; j < g_users[i].emails.length; j++) {
      if (email === g_users[i].emails[j]) return g_users[i];
    }
  }
  return undefined;
};

exports.isStaged = function(email) {
  // XXX: not efficient
  for (var k in g_staged) {
    if (g_staged[k].email === email) return true;
  }
  return false;
};

function generateSecret() {
  var str = "";
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (var i=0; i < 32; i++) {
    str += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }
  return str;
}

exports.addEmailToAccount = function(existing_email, email, pubkey) {
  var acct = exports.findByEmail(existing_email);
  if (acct === undefined) throw "no such email: " + existing_email;
  if (acct.emails.indexOf(email) == -1) acct.emails.push(email);
  acct.keys.push(email);
  return;
}

/* takes an argument object including email, pass, and pubkey. */
exports.stageUser = function(obj) {
  var secret = generateSecret();
  // overwrite previously staged users
  g_staged[secret] = {
    type: "add_account",
    email: obj.email,
    pubkey: obj.pubkey,
    pass: obj.pass
  };
  return secret;
};

/* takes an argument object including email, pass, and pubkey. */
exports.stageEmail = function(existing_email, new_email, pubkey) {
  var secret = generateSecret();
  // overwrite previously staged users
  g_staged[secret] = {
    type: "add_email",
    existing_email: existing_email,
    email: new_email,
    pubkey: pubkey
  };
  return secret;
};

/* invoked when a user clicks on a verification URL in their email */ 
exports.gotVerificationSecret = function(secret) {
  if (!g_staged.hasOwnProperty(secret)) return false;

  // simply move from staged over to the emails "database"
  var o = g_staged[secret];
  delete g_staged[secret];
  if (o.type === 'add_account') {
    if (undefined != exports.findByEmail(o.email)) {
      throw "email already exists!";
    }
    g_users.push({
      emails: [ o.email ],
      keys: [ o.pubkey ],
      pass: o.pass
    });
  } else if (o.type === 'add_email') {
    exports.addEmailToAccount(o.existing_email, o.email, o.pubkey);
  } else {
    return false;
  }

  return true;
};

/* takes an argument object including email, pass, and pubkey. */
exports.checkAuth = function(email, pass) {
  var acct = exports.findByEmail(email);
  if (acct === undefined) return false;
  return pass === acct.pass;
};

/* a high level operation that attempts to sync a client's view with that of the
 * server.  email is the identity of the authenticated channel with the user,
 * identities is a map of email -> pubkey.
 * We'll return an object that expresses three different types of information:
 * there are several things we need to express:
 * 1. emails that the client knows about but we do not
 * 2. emails that we know about and the client does not
 * 3. emails that we both know about but who need to be re-keyed
 * NOTE: it's not neccesary to differentiate between #2 and #3, as the client action
 *       is the same (regen keypair and tell us about it).
 */
exports.getSyncResponse = function(email, identities) {
  var respBody = {
    unknown_emails: [ ],
    key_refresh: [ ]
  };

  // fetch user acct
  var acct = exports.findByEmail(email);

  // #1
  for (var e in identities) {
    if (acct.emails.indexOf(e) == -1) respBody.unknown_emails.push(e);
  }

  // #2
  for (var e in acct.emails) {
    e = acct.emails[e];
    if (!identities.hasOwnProperty(e)) respBody.key_refresh.push(e);
  }

  // #3
  // XXX todo

  return respBody;
};