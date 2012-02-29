/**
 * urlparse.js
 *
 * Includes parseUri (c) Steven Levithan <steven@levithan.com> Under the MIT License
 *
 * Features:
 *  + parse a url into components
 *  + url validiation
 *  + semantically lossless normalization
 *  + url prefix matching
 *
 * window.URLParse(string) -
 *   parse a url using the 'parseUri' algorithm, returning an object containing various
 *   uri components. returns an object with the following properties (all optional):
 *
 *   PROPERTIES:
 *     anchor - stuff after the #
 *     authority - everything after the :// and before the path.  Including user auth, host, and port
 *     directory - path with trailing filename and everything after removed
 *     file - path without directory
 *     host - host
 *     password - password part when user:pass@ is prepended to host
 *     path - full path, sans query or anchor
 *     port - port, when present in url
 *     query - ?XXX
 *     relative -
 *     scheme - url scheme (http, file, https, etc.)
 *     source - full string passed to URLParse()
 *     user - user part when user:pass@ is prepended to host
 *     userInfo -
 *
 *   FUNCTIONS:
 *     (string) toString() - generate a string representation of the url
 *
 *     (this) validate() - validate the url, possbly throwing a string exception
 *        if determined to not be a valid URL.  Returns this, thus may be chained.
 *
 *     (this) normalize() - perform in-place modification of the url to place it in a normal
 *        (and verbose) form. Returns this, thus may be chained.
 *
 *     (bool) contains(str) - returns whether the object upon which contains() is called is a
 *        "url prefix" for the passed in string, after normalization.
 *
 *     (this) originOnly() - removes everything that would occur after port, including
 *        path, query, and anchor.
 *
 */

(function() {
    /* const */ var INV_URL = "invalid url: ";
    var parseURL = function(s) {
        var toString = function() {
            var str = this.scheme + "://";
            if (this.user) str += this.user;
            if (this.password) str += ":" + this.password;
            if (this.user || this.password) str += "@";
            if (this.host) str += this.host;
            if (this.port) str += ":" + this.port;
            if (this.path) str += this.path;
            if (this.query) str += "?" + this.query;
            if (this.anchor) str += "#" + this.anchor;
            return str;
        };

        var originOnly = function() {
            this.path = this.query = this.anchor = undefined;
            return this;
        };

        var validate = function() {
            if (!this.scheme) throw INV_URL +"missing scheme";
            if (this.scheme !== 'http' && this.scheme !== 'https')
                throw INV_URL + "unsupported scheme: " + this.scheme;
            if (!this.host) throw INV_URL + "missing host";
            if (this.port) {
                var p = parseInt(this.port);
                if (!this.port.match(/^\d+$/)) throw INV_URL + "non-numeric numbers in port";
                if (p <= 0 || p >= 65536) throw INV_URL + "port out of range (" +this.port+")";
            }
            if (this.path && this.path.indexOf('/') != 0) throw INV_URL + "path must start with '/'";

            return this;
        };

        var normalize = function() {
            // lowercase scheme
            if (this.scheme) this.scheme = this.scheme.toLowerCase();

            // for directory references, append trailing slash
            if (!this.path) this.path = "/";

            // remove port numbers same as default
            if (this.port === "80" && 'http' === this.scheme) delete this.port;
            if (this.port === "443" && 'https' === this.scheme) delete this.port;

            // remove dot segments from path, algorithm
            // http://tools.ietf.org/html/rfc3986#section-5.2.4
            this.path = (function (p) {
                var out = [];
                while (p) {
                    if (p.indexOf('../') === 0) p = p.substr(3);
                    else if (p.indexOf('./') === 0) p = p.substr(2);
                    else if (p.indexOf('/./') === 0) p = p.substr(2);
                    else if (p === '/.') p = '/';
                    else if (p.indexOf('/../') === 0 || p === '/..') {
                        if (out.length > 0) out.pop();
                        p = '/' + p.substr(4);
                    } else if (p === '.' || p === '..') p = '';
                    else {
                        var m = p.match(/^\/?([^\/]*)/);
                        // remove path match from input
                        p = p.substr(m[0].length);
                        // add path to output
                        out.push(m[1]);
                    }
                }
                return '/' + out.join('/');
            })(this.path);

            // XXX: upcase chars in % escaping?

            // now we need to update all members
            var n = parseURL(this.toString()),
            i = 14,
            o = parseUri.options;

            while (i--) {
                var k = o.key[i];
                if (n[k] && typeof(n[k]) === 'string') this[k] = n[k];
                else if (this[k] && typeof(this[k]) === 'string') delete this[k];
            }

            return this;
        };

        var contains = function(str) {
            try {
                this.validate();
                var prefix = parseURL(this.toString()).normalize().toString();
                var url = parseURL(str).validate().normalize().toString();
                return (url.indexOf(prefix) === 0);
            } catch(e) {
                console.log(e);
                // if any exceptions are raised, then the comparison fails
                return false;
            }
        };

        // parseUri 1.2.2
        // (c) Steven Levithan <stevenlevithan.com>
        // MIT License
        var parseUri = function(str) {
            var o   = parseUri.options,
            m   = o.parser.exec(str),
            uri = {},
            i   = 14;

            while (i--) if (m[i]) uri[o.key[i]] = m[i];

            if (uri[o.key[12]]) {
                uri[o.q.name] = {};
                uri[o.key[12]].replace(o.q.parser, function ($0, $1, $2) {
                    if ($1) uri[o.q.name][$1] = $2;
                });
            }
            // member functions
            uri.toString = toString;
            uri.validate = validate;
            uri.normalize = normalize;
            uri.contains = contains;
            uri.originOnly = originOnly;
            return uri;
        };

        parseUri.options = {
            key: ["source","scheme","authority","userInfo","user","password","host","port","relative","path","directory","file","query","anchor"],
            q:   {
                name:   "queryKey",
                parser: /(?:^|&)([^&=]*)=?([^&]*)/g
            },
            parser: /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/
        };
        // end parseUri

        // parse URI using the parseUri code and return the resultant object
        return parseUri(s);
    };

  if (typeof exports === 'undefined') window.URLParse = parseURL;
  else module.exports = parseURL;
})();
