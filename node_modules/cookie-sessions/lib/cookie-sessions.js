var crypto = require('crypto');
var url = require('url');

var exports = module.exports = function(settings){

    var default_settings = {
        // don't set a default cookie secret, must be explicitly defined
        session_key: '_node',
        timeout: 1000 * 60 * 60 * 24, // 24 hours
        path: '/'
    };
    var s = extend(default_settings, settings);
    if(!s.secret) throw new Error('No secret set in cookie-session settings');

    if(typeof s.path !== 'string' || s.path.indexOf('/') != 0)
        throw new Error('invalid cookie path, must start with "/"');

    return function(req, res, next){
        // if the request is not under the specified path, do nothing.
        if (url.parse(req.url).pathname.indexOf(s.path) != 0) {
            next();
            return;
        }

        // Read session data from a request and store it in req.session
        req.session = exports.readSession(
            s.session_key, s.secret, s.timeout, req);

        // proxy writeHead to add cookie to response
        var _writeHead = res.writeHead;
        res.writeHead = function(statusCode){

            var reasonPhrase, headers;
            if (typeof arguments[1] === 'string') {
                reasonPhrase = arguments[1];
                headers = arguments[2] || {};
            }
            else {
                headers = arguments[1] || {};
            }

            // Add a Set-Cookie header to all responses with the session data
            // and the current timestamp. The cookie needs to be set on every
            // response so that the timestamp is up to date, and the session
            // does not expire unless the user is inactive.

            var cookiestr;
            if (req.session === undefined) {
                if ("cookie" in req.headers) {
                    cookiestr = escape(s.session_key) + '='
                        + '; expires=' + exports.expires(0)
                        + '; path=' + s.path;
                }
            } else {
                cookiestr = escape(s.session_key) + '='
                    + escape(exports.serialize(s.secret, req.session))
                    + '; expires=' + exports.expires(s.timeout)
                    + '; path=' + s.path;
            }
            
            if (cookiestr !== undefined) {
                if(Array.isArray(headers)) headers.push(['Set-Cookie', cookiestr]);
                else {
                    // if a Set-Cookie header already exists, convert headers to
                    // array so we can send multiple Set-Cookie headers.
                    if(headers['Set-Cookie'] !== undefined){
                        headers = exports.headersToArray(headers);
                        headers.push(['Set-Cookie', cookiestr]);
                    }
                    // if no Set-Cookie header exists, leave the headers as an
                    // object, and add a Set-Cookie property
                    else {
                        headers['Set-Cookie'] = cookiestr;
                    }
                }
            }

            var args = [statusCode, reasonPhrase, headers];
            if (!args[1]) {
                args.splice(1, 1);
            }
            // call the original writeHead on the request
            return _writeHead.apply(res, args);
        }
        next();

    };
};

exports.headersToArray = function(headers){
    if(Array.isArray(headers)) return headers;
    return Object.keys(headers).reduce(function(arr, k){
        arr.push([k, headers[k]]);
        return arr;
    }, []);
};


// Extend a given object with all the properties in passed-in object(s).
// From underscore.js (http://documentcloud.github.com/underscore/)
function extend(obj) {
    Array.prototype.slice.call(arguments).forEach(function(source) {
      for (var prop in source) obj[prop] = source[prop];
    });
    return obj;
};

exports.deserialize = function(secret, timeout, str){
    // Parses a secure cookie string, returning the object stored within it.
    // Throws an exception if the secure cookie string does not validate.

    if(!exports.valid(secret, timeout, str)){
        throw new Error('invalid cookie');
    }
    var data = exports.decrypt(secret, exports.split(str).data_blob);
    return JSON.parse(data);
};

exports.serialize = function(secret, data){
    // Turns a JSON-compatibile object literal into a secure cookie string

    var data_str = JSON.stringify(data);
    var data_enc = exports.encrypt(secret, data_str);
    var timestamp = (new Date()).getTime();
    var hmac_sig = exports.hmac_signature(secret, timestamp, data_enc);
    var result = hmac_sig + timestamp + data_enc;
    if(!exports.checkLength(result)){
        throw new Error('data too long to store in a cookie');
    }
    return result;
};

exports.split = function(str){
    // Splits a cookie string into hmac signature, timestamp and data blob.
    return {
        hmac_signature: str.slice(0,40),
        timestamp: parseInt(str.slice(40, 53), 10),
        data_blob: str.slice(53)
    };
};

exports.hmac_signature = function(secret, timestamp, data){
    // Generates a HMAC for the timestamped data, returning the
    // hex digest for the signature.
    var hmac = crypto.createHmac('sha1', secret);
    hmac.update(timestamp + data);
    return hmac.digest('hex');
};

exports.valid = function(secret, timeout, str){
    // Tests the validity of a cookie string. Returns true if the HMAC
    // signature of the secret, timestamp and data blob matches the HMAC in the
    // cookie string, and the cookie's age is less than the timeout value.

    var parts = exports.split(str);
    var hmac_sig = exports.hmac_signature(
        secret, parts.timestamp, parts.data_blob
    );
    return (
        parts.hmac_signature === hmac_sig &&
        parts.timestamp + timeout > new Date().getTime()
    );
};

exports.decrypt = function(secret, str){
    // Decrypt the aes192 encoded str using secret.
    var decipher = crypto.createDecipher("aes192", secret);
    return decipher.update(str, 'hex', 'utf8') + decipher.final('utf8');
};

exports.encrypt = function(secret, str){
    // Encrypt the str with aes192 using secret.
    var cipher = crypto.createCipher("aes192", secret);
    return cipher.update(str, 'utf8', 'hex') + cipher.final('hex');
};

exports.checkLength = function(str){
    // Test if a string is within the maximum length allowed for a cookie.
    return str.length <= 4096;
};

exports.readCookies = function(req){
    // if "cookieDecoder" is in use, then req.cookies
    // will already contain the parsed cookies
    if (req.cookies) {
        return req.cookies;
    }
    else {
        // Extracts the cookies from a request object.
        var cookie = req.headers.cookie;
        if(!cookie){
            return {};
        }
        var parts = cookie.split(/\s*;\s*/g).map(function(x){
            return x.split('=');
        });
        return parts.reduce(function(a, x){
            a[unescape(x[0])] = unescape(x[1]);
            return a;
        }, {});
    }
};

exports.readSession = function(key, secret, timeout, req){
    // Reads the session data stored in the cookie named 'key' if it validates,
    // otherwise returns an empty object.

    var cookies = exports.readCookies(req);
    if(cookies[key]){
        return exports.deserialize(secret, timeout, cookies[key]);
    }
    return undefined;
};


exports.expires = function(timeout){
    return (new Date(new Date().getTime() + (timeout))).toUTCString();
};
