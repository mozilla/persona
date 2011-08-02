/*
 * An abstraction which contains various pre-set deployment
 * environments and adjusts runtime configuration appropriate for
 * the current environmnet (specified via the NODE_ENV env var)..
 *
 * usage is
 *   exports.configure(app);
 */

const substitution = require('./substitute.js');

if (undefined === process.env['NODE_ENV']) {
  process.env['NODE_ENV'] = 'local';
}

exports.configure = function(app) {
  if (!app) throw "configure requires express app as argument"; 

  var known = false;

  app.enable('use_minified_resources');

  app.configure('production', function() {
    app.set('hostname', 'browserid.org');
    app.set('port', '443');
    app.set('scheme', 'https');
    known = true;
  });

  app.configure('development', function() {
    app.set('hostname', 'dev.diresworb.org');
    app.set('port', '443');
    app.set('scheme', 'https');
    known = true;
  });

  app.configure('beta', function() {
    app.set('hostname', 'diresworb.org');
    app.set('port', '443');
    app.set('scheme', 'https');
    known = true;
  });

  app.configure('local', function() {
    app.set('hostname', '127.0.0.1');
    app.set('port', '10001');
    app.set('scheme', 'http');
    app.disable('use_minified_resources');
    known = true;
  });

  if (!known) throw "unknown environment: " + process.env('NODE_ENV');

  function getPortForURL() {
    if (app.set('scheme') === 'https' && app.set('port') === '443') return "";
    if (app.set('scheme') === 'http' && app.set('port') === '80') return "";
    return ":" + app.set('port');
  }

  app.set('URL',
          app.set('scheme') +
          '://' +
          app.set('hostname') +
          getPortForURL());
};

/*
 * Install middleware that will perform textual replacement on served output
 * to re-write urls as needed for this particular environment.
 *
 * Note, for a 'local' environment, no re-write is needed because this is
 * handled at a higher level.  For a 'production' env no rewrite is necc cause
 * all source files are written for that environment.
 */
exports.performSubstitution = function(app) {
  if (process.env['NODE_ENV'] !== 'production' &&
      process.env['NODE_ENV'] !== 'local') {
    app.use(substitution.substitute({
      'https://browserid.org': app.set('URL'),
      'browserid.org:443': app.set('hostname') + ':' + app.set('port'),
      'browserid.org': app.set('hostname')
    }));
  }
};

