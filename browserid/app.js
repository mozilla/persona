const        path = require('path'),
              url = require('url'),
               fs = require('fs'),
            wsapi = require('./lib/wsapi.js'),
        httputils = require('./lib/httputils.js'),
        webfinger = require('./lib/webfinger.js'),
         sessions = require('cookie-sessions'),
          secrets = require('./lib/secrets.js');

// create the var directory if it doesn't exist
var VAR_DIR = path.join(__dirname, "var");
try { fs.mkdirSync(VAR_DIR, 0755); } catch(e) { }

const STATIC_DIR = path.join(path.dirname(__dirname), "static");

const COOKIE_SECRET = secrets.hydrateSecret('cookie_secret', VAR_DIR);

function handler(request, response, next) {
    // dispatch!
    var urlpath = url.parse(request.url).pathname;

    if (urlpath === '/sign_in') {
        // a little remapping!
        request.url = "/dialog/index.html";
        next();
    } else if (urlpath === '/register_iframe') {
        request.url = "/dialog/register_iframe.html";
        next();
    } else if (/^\/wsapi\/\w+$/.test(urlpath)) {
        try {
            var method = path.basename(urlpath);
            wsapi[method](request, response);
        } catch(e) {
            var errMsg = "oops, error executing wsapi method: " + method + " (" + e.toString() +")";
            console.log(errMsg);
            httputils.fourOhFour(response, errMsg);
        }
    } else if (/^\/users\/[^\/]+.xml$/.test(urlpath)) {
        var identity = path.basename(urlpath).replace(/.xml$/, '').replace(/^acct:/, '');

        webfinger.renderUserPage(identity, function (resultDocument) {
            if (resultDocument === undefined) {
                httputils.fourOhFour(response, "I don't know anything about: " + identity + "\n");
            } else {
                httputils.xmlResponse(response, resultDocument);
            }
        });
    } else if (urlpath === "/code_update") {
        console.log("code updated.  shutting down.");
        process.exit();
    } else {
        next();
    }
};

exports.varDir = VAR_DIR;

exports.setup = function(server) {
    var week = (7 * 24 * 60 * 60 * 1000);
    server.use(sessions({
        secret: COOKIE_SECRET,
        session_key: "browserid_state",
        path: '/'
    }));

    server.use(handler);

    // a tweak to get the content type of host-meta correct
    server.use(function(req, resp, next) {
        if (req.url === '/.well-known/host-meta') {
            resp.setHeader('content-type', 'text/xml');
        }
        next();
    });
}
