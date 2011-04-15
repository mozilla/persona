# Cookie-Sessions

Secure cookie-based session middleware for
[Connect](http://github.com/senchalabs/connect). This is a new module and I
wouldn't recommend for production use just yet.

Session data is stored on the request object in the 'session' property:

    var connect = require('connect'),
        sessions = require('cookie-sessions');

    Connect.createServer(
        sessions({secret: '123abc'}),
        function(req, res, next){
            req.session = {'hello':'world'};
            res.writeHead(200, {'Content-Type':'text/plain'});
            res.end('session data updated');
        }
    ).listen(8080);

The session data is JSON.stringified, encrypted and timestamped, then a HMAC
signature is attached to test for tampering. The main function accepts a
number of options:

    * secret -- The secret to encrypt the session data with
    * timeout -- The amount of time in miliseconds before the cookie expires
      (default: 24 hours)
    * session_key -- The cookie key name to store the session data in
      (default: _node)


## Why store session data in cookies?

* Its fast, you don't need to hit the filesystem or a database to look up
  session data
* It scales easily. You don't need to worry about sticky-sessions when
  load-balancing across multiple nodes.
* No server-side persistence requirements

## Caveats

* You can only store 4k of data in a cookie
* Higher-bandwidth requirements, since the cookie is sent to the server with
  every request.

__In summary:__ don't use cookie storage if you keep a lot of data in your
sessions!
