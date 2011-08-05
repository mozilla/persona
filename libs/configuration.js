/*
 * An abstraction which contains various pre-set deployment
 * environments and adjusts runtime configuration appropriate for
 * the current environmnet (specified via the NODE_ENV env var)..
 *
 * usage is
 *   exports.configure(app);
 */

const substitution = require('./substitute.js');

var g_config = {
};

// get the value for a given key, this mechanism allows the rest of the
// application to reach in and set
exports.get = function(val) {
  if (val === 'env') return process.env['NODE_ENV'];
  return g_config[val];
}

var defaultHostedDatabaseConfig = {
  driver: "mysql",
  user: 'browserid',
  password: 'browserid'
};

// various deployment configurations
const g_configs = {
  production: {
    hostname: 'browserid.org',
    port: '443',
    scheme: 'https',
    use_minified_resources: true,
    log_path: '/home/browserid/var/',
    database: defaultHostedDatabaseConfig
  },
  development: {
    hostname: 'dev.diresworb.org',
    port: '443',
    scheme: 'https',
    use_minified_resources: true,
    log_path: '/home/browserid/var/',
    database: defaultHostedDatabaseConfig
  },
  beta: {
    hostname: 'diresworb.org',
    port: '443',
    scheme: 'https',
    use_minified_resources: true,
    log_path: '/home/browserid/var/',
    database: defaultHostedDatabaseConfig
  },
  local: {
    hostname: '127.0.0.1',
    port: '10002',
    scheme: 'http',
    use_minified_resources: false,
    log_path: './',
    database: { driver: "json" }
  }
};

// default deployment is local
if (undefined === process.env['NODE_ENV']) {
  process.env['NODE_ENV'] = 'local';
}

g_config = g_configs[process.env['NODE_ENV']];

if (g_config === undefined) throw "unknown environment: " + exports.get('env');

function getPortForURL() {
  if (g_config['scheme'] === 'https' && g_config['port'] === '443') return "";
  if (g_config['scheme'] === 'http' && g_config['port'] === '80') return "";
  return ":" + g_config['port'];
}

g_config['URL'] = g_config['scheme'] + '://' + g_config['hostname'] + getPortForURL();

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
      'https://browserid.org': g_config['URL'],
      'browserid.org:443': g_config['hostname'] + ':' + g_config['port'],
      'browserid.org': g_config['hostname']
    }));
  }
};

