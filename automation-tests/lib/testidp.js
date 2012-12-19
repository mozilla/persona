var _ = require('underscore'),
    request = require('request'),
    restmail = require('./restmail.js'),
    URLS = require('./urls');

const TESTIDP_API = 'https://testidp.org/api/';

// Compatible with Q.ncall
exports.qCreateIdP = function (cb) {
  request({
    url: TESTIDP_API + 'domain',
    qs: {
      env: URLS['persona']
    }
  }, function(err, response, body) {
    if (err) return cb(err);

    var obj = {
      // details of the created idp, including 'domain' and 'password'
      // properties
      idp: JSON.parse(body),

      // getRandomEmail() - a function to generate a random email for
      // this domain
      getRandomEmail: function() {
        return restmail.randomEmail(10, this.idp.domain + '.testidp.org');
      },

      // given a well known document as an argument, add the domain's public
      // key to it as a property 'public-key'.
      //
      // (NOTE: what is actually inserted is a substitution marker that
      //  testidp.org will replace with the domain's pub key.)
      addPublicKey: module.exports.addPublicKey,

      // setWellKnown() - set the well-known document for the domain, represented
      // as a string or javascript object.
      setWellKnown: function(document, cb) {
        if (typeof document === 'object') document = JSON.stringify(document, null, 3);

        request.put({
          url: TESTIDP_API + this.idp.domain + "/well-known",
          json: true,
          body: document,
          headers: {
            'x-password': this.idp.password
          }
        }, function(err, response, body) {
          if (err) return cb(err);
          if (!body.ok) return cb(body.why);
          cb(null);
        });
      },
      // *explicitly* disable this domain.  Meaning persona should
      // detect that this domain has intentionally disabled support and immediately
      // fallback to secondary verification of email addresses
      disableSupport: function(cb) {
        this.setWellKnown({ disabled: true }, cb);
      },
      // turn off support for this domain.  If persona has seen this
      // domain recently, it will assume the domain is temporarily broken.
      turnOffSupport: function(cb) {
        this.setWellKnown("", cb);
      },
      // Enable primary support for this domain.  support comes in two flavors:
      // * click - the user is always redirected to the domain inside the dialog
      //    to "authenticate".  authentication is simply clicking a button.
      // * noauth - the user is always considered authenticated to the IdP.
      // if a boolean first argument is provided, true is click, false is noauth.
      enableSupport: function(click, cb) {
        // default to 'click' if the caller doesn't specify desired behavior for the
        // idp
        if (typeof click === 'function') {
          cb = click;
          click = true;
        }
        var obj = {};
        if (click) {
          obj.authentication = '/click/auth.html';
          obj.provisioning = '/click/prov.html';
        } else {
          obj.authentication = '/noauth/auth.html';
          obj.provisioning = '/noauth/prov.html';
        }
        this.addPublicKey(obj);
        this.setWellKnown(obj, cb);
      }
    };

    // pre-populate the response object with a single random email for
    // convenience.
    obj.email = obj.getRandomEmail();

    cb(err, obj);
  });
};

function putJson(idp, params, api, cb) {
  put(idp, {json: params}, api, cb);
}
function putForm(idp, params, api, cb) {
  put(idp, {form: params}, api, cb);
}
function put(idp, opts, api, cb) {
  request(_.extend({
    url: 'https://testidp.org/api/' + idp.domain + '/' + api,
    method: 'PUT',
    headers: {
     'X-Password': idp.password
    },
    encoding: 'utf8'
  }, opts), cb);
}

const NO_AUTH = exports.NO_AUTH = {
  "authentication": "/noauth/auth.html",
  "provisioning": "/noauth/prov.html"
};

exports.CreateIdP = function (idp) {
  return {
    /**
     * @param {object} wellKnown
     * @param {boolean} addGoodKey - public-key field will be populated
     *                  with actual keypair
     * @param {function} cb - request compatible callback
     */
    putWellKnown: function (wellKnown, addGoodKey, cb) {
      if (addGoodKey) module.exports.addPublicKey(wellKnown);
      putJson(idp, wellKnown, 'well-known', cb);
    },
    /**
     * @param {object} envUrl - Must start with http and end with /
     * @param {function} cb - request compatible callback
     */
    putEnv: function (envUrl, cb) {
      putForm(idp, {env: envUrl}, 'env', cb);
    },
    /**
     * @param {string} name
     * @param {string} value
     * @param {function} cb - request compatible callback
     */
    putHeaders: function(name, value, cb) {
      var headers = {};
      headers[name] = value;
      putJson(idp, headers, 'headers', cb);
    },
    /**
     * @param {function} cb - request compatible callback
     */
    deleteIdp: function(cb) {
      request({
        url: 'https://testidp.org/api/' + idp.domain,
        method: 'DELETE',
        headers: {
         'X-Password': idp.password
        },
        encoding: 'utf8'
      }, cb);
    },
    getNoAuth: function () { return NO_AUTH; }
  };
};

/**
 * @param {object}
 * @return updated wellKnown - provided for chaining, object gets
 *                 updated either way
 */
exports.addPublicKey = function (wellKnown) {
  wellKnown['public-key'] = '<TEST IDP PROVIDED>';
  return wellKnown;
};
