const metrics = require('../metrics.js');

// all templated content, redirects, and renames are handled here.
// anything that is not an api, and not static

const
path = require('path');

exports.setup = function(app) {
  app.set("views", path.join(__dirname, "..", "..", "resources", "views"));

  app.set('view options', {
    production: config.get('use_minified_resources')
  });

  // this should probably be an internal redirect
  // as soon as relative paths are figured out.
  app.get('/sign_in', function(req, res, next ) {
    metrics.userEntry(req);
    res.render('dialog.ejs', {
      title: 'A Better Way to Sign In',
      layout: 'dialog_layout.ejs',
      useJavascript: true,
      production: config.get('use_minified_resources')
    });
  });

  app.get('/communication_iframe', function(req, res, next ) {
    res.removeHeader('x-frame-options');
    res.render('communication_iframe.ejs', {
      layout: false,
      production: config.get('use_minified_resources')
    });
  });

  app.get("/unsupported_dialog", function(req,res) {
    res.render('unsupported_dialog.ejs', {layout: 'dialog_layout.ejs', useJavascript: false});
  });

  // Used for a relay page for communication.
  app.get("/relay", function(req,res, next) {
    // Allow the relay to be run within a frame
    res.removeHeader('x-frame-options');
    res.render('relay.ejs', {
      layout: false,
      production: config.get('use_minified_resources')
    });
  });

  app.get('/', function(req,res) {
    res.render('index.ejs', {title: 'A Better Way to Sign In', fullpage: true});
  });

  app.get("/signup", function(req, res) {
    res.render('signup.ejs', {title: 'Sign Up', fullpage: false});
  });

  app.get("/forgot", function(req, res) {
    res.render('forgot.ejs', {title: 'Forgot Password', fullpage: false, email: req.query.email});
  });

  app.get("/signin", function(req, res) {
    res.render('signin.ejs', {title: 'Sign In', fullpage: false});
  });

  app.get("/about", function(req, res) {
    res.render('about.ejs', {title: 'About', fullpage: false});
  });

  app.get("/tos", function(req, res) {
    res.render('tos.ejs', {title: 'Terms of Service', fullpage: false});
  });

  app.get("/privacy", function(req, res) {
    res.render('privacy.ejs', {title: 'Privacy Policy', fullpage: false});
  });

  app.get("/verify_email_address", function(req, res) {
    res.render('verifyuser.ejs', {title: 'Complete Registration', fullpage: true, token: req.query.token});
  });

  app.get("/add_email_address", function(req,res) {
    res.render('verifyemail.ejs', {title: 'Verify Email Address', fullpage: false});
  });

  // REDIRECTS
  REDIRECTS = {
    "/manage": "/",
    "/users": "/",
    "/users/": "/",
    "/primaries" : "/developers",
    "/primaries/" : "/developers",
    "/developers" : "https://github.com/mozilla/browserid/wiki/How-to-Use-BrowserID-on-Your-Site"
  };

  // set up all the redirects
  // oh my watch out for scope issues on var url - closure time
  for (var url in REDIRECTS) {
    (function(from,to) {
      app.get(from, function(req, res) {
        res.redirect(to);
      });
    })(url, REDIRECTS[url]);
  }

  // the public key
  app.get("/pk", function(req, res) {
    res.json(config.get('public_key').toSimpleObject());
  });

  // vep bundle of JavaScript
  try {
    const vepBundleFilePath = path.join(__dirname, "..", "..", "node_modules", "jwcrypto", "vepbundle.js");
    var vepBundleFile = fs.readFileSync(vepBundleFilePath);
  } catch(e) {
    logger.error("can't read vepbundle file (" + vepBundleFilePath +"): " + e);
  }

  app.get("/vepbundle", function(req, res) {
    res.writeHead(200, {'Content-Type': 'text/javascript'});
    res.write(vepBundleFile);
    res.end();
  });
};
