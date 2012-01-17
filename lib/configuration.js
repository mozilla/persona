/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * An abstraction which contains various pre-set deployment
 * environments and adjusts runtime configuration appropriate for
 * the current environmnet (specified via the NODE_ENV env var)..
 *
 * usage is
 *   exports.configure(app);
 */

const
postprocess = require('postprocess'),
path = require('path'),
urlparse = require('urlparse'),
secrets = require('./secrets'),
temp = require('temp'),
semver = require('semver'),
fs = require('fs');

// verify the proper version of node.js is in use
try {
  var required = 'unknown';
  // extract required node version from package.json
  required = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"))).engines.node;
  if (!semver.satisfies(process.version, required)) throw false;
} catch (e) {
  process.stderr.write("update node! verision " + process.version +
                       " is not " + required +
                       (e ? " (" + e + ")" : "") + "\n");
  process.exit(1);
}

var g_config = {
};

// get the value for a given key, this mechanism allows the rest of the
// application to reach in and set
exports.get = function(key) {
  if (key === 'env') return process.env['NODE_ENV'];
  return g_config[key];
}

// allow the application to set configuration variables
// iff we're in a test_ environment
exports.set = function(key, val) {
  if (!/^test_/.test(exports.get('env')))
    throw "you may only set configuration variables in a test_ environment " +
          "(not in '" + exports.get('env') + "')";
  g_config[key] = val;
}

// *** the various deployment configurations ***
const g_configs = { };

// production is the configuration that runs on our
// public service (browserid.org)
g_configs.production = {
  URL: 'https://browserid.org',
  use_minified_resources: true,
  var_path: '/home/browserid/var/',
  database: {
    driver: "mysql",
    user: 'browserid',
    create_schema: true,
    may_write: false
  },
  statsd: {
    enabled: false
  },
  bcrypt_work_factor: 12,
  authentication_duration_ms: (2 * 7 * 24 * 60 * 60 * 1000),
  certificate_validity_ms: (24 * 60 * 60 * 1000),
  min_time_between_emails_ms: (60 * 1000),
  // may be specified to manipulate the maximum number of compute processes
  max_compute_processes: undefined,
  // return a 503 if a compute process would take over 10s to complete
  max_compute_duration: 10,
  disable_primary_support: true,
  /*
  , http_proxy: {
    port: 3128,
    host: "127.0.0.1"
  }
  */
  default_lang: ['en-US'],
  supported_languages: ['en-US'],
  // Contains po files
  locale_directory: 'locale'
};

// local development configuration
g_configs.local =  {
  URL: 'http://127.0.0.1:10002',
  email_to_console: true, // don't send email, just dump verification URLs to console.
  use_minified_resources: false,
  var_path: path.join(__dirname, "..", "var"),
  database: {
    driver: "json",
    may_write: false
  },
  bcrypt_work_factor: g_configs.production.bcrypt_work_factor,
  authentication_duration_ms: g_configs.production.authentication_duration_ms,
  certificate_validity_ms: g_configs.production.certificate_validity_ms,
  min_time_between_emails_ms: g_configs.production.min_time_between_emails_ms,
  max_compute_processes: undefined,
  max_compute_duration: 10,
  disable_primary_support: false,
/*
  , http_proxy: {
    port: 3128,
    host: "127.0.0.1"
  }
*/
  default_lang: g_configs.production.default_lang,
  supported_languages: ['eo', 'en-US', 'db-LB'],
  locale_directory: g_configs.production.locale_directory
};

// test environments are variations on local
g_configs.test_json = JSON.parse(JSON.stringify(g_configs.local));
g_configs.test_json.database = {
  driver: "json"
};

g_configs.test_mysql = JSON.parse(JSON.stringify(g_configs.local));
g_configs.test_mysql.database = {
  driver: "mysql",
  user: "test",
  create_schema: true
};

if (undefined !== process.env['NODE_EXTRA_CONFIG']) {
  eval(fs.readFileSync(process.env['NODE_EXTRA_CONFIG']) + '');
}

// default deployment is local
if (undefined === process.env['NODE_ENV']) {
  process.env['NODE_ENV'] = 'local';
}

g_config = g_configs[process.env['NODE_ENV']];

if (g_config === undefined) throw "unknown environment: " + exports.get('env');

// what url are we running under?
{
  var ourURL = process.env['BROWSERID_URL'] || g_config['URL'];
  var purl = urlparse(ourURL).validate().normalize().originOnly();

  g_config.URL = purl.toString();
  g_config.hostname = purl.host;
  g_config.scheme = purl.scheme;
  g_config.port = purl.port || (purl.scheme == 'https' ? 443 : 80);
}

if (process.env['VERIFIER_URL']) {
  var url = urlparse(process.env['VERIFIER_URL']).validate().normalize();
  if (!url.port) url.port = (url.scheme === 'http') ? 80 : 443;
  g_config.verifier_url = url;
}

if (process.env['KEYSIGNER_URL']) {
  var url = urlparse(process.env['KEYSIGNER_URL']).validate().normalize();
  if (!url.port) url.port = (url.scheme === 'http') ? 80 : 443;
  g_config.keysigner_url = url;
}

if (process.env['DBWRITER_URL']) {
  var url = urlparse(process.env['DBWRITER_URL']).validate().normalize();
  if (!url.port) url.port = (url.scheme === 'http') ? 80 : 443;
  g_config.dbwriter_url = url;
}

// extract smtp params from the environment
if (!g_config.smtp) {
  g_config.smtp = {
    host: process.env['SMTP_HOST'],
    user: process.env['SMTP_USER'],
    pass: process.env['SMTP_PASS']
  };
}

// now handle ephemeral database configuration.  Used in testing.
if (g_config.database.driver === 'mysql') {
  if (process.env['MYSQL_DATABASE_NAME']) {
    g_config.database.database = process.env['MYSQL_DATABASE_NAME'];
  }
} else if (g_config.database.driver === 'json') {
  if (process.env['JSON_DATABASE_PATH']) {
    g_config.database.path = process.env['JSON_DATABASE_PATH'];
  }
}

// allow work factor to be twaddled from the environment
if (process.env['BCRYPT_WORK_FACTOR']) {
  g_config.bcrypt_work_factor = parseInt(process.env['BCRYPT_WORK_FACTOR']);
}

// allow the number of cores used to be specified from the environment,
// default will something reasonable.
if (process.env['MAX_COMPUTE_PROCESSES']) {
  g_config.max_compute_processes = parseInt(process.env['MAX_COMPUTE_PROCESSES']);
}

// allow var_path to be specified in the environment
if (process.env['VAR_PATH']) {
  g_config.var_path = process.env['VAR_PATH'];
}

// allow statsd to be enabled from the environment
if (process.env['ENABLE_STATSD']) {
  g_config.statsd = { enabled: true };
}

// what host/port shall we bind to?
g_config.bind_to = {
  host: process.env['IP_ADDRESS'] || process.env['HOST'] || "127.0.0.1",
  port: process.env['PORT'] || 0
};

/*
 * Install middleware that will perform textual replacement on served output
 * to re-write urls as needed for this particular environment.
 *
 * Note, for a 'local' environment, no re-write is needed because this is
 * handled at a higher level.  For other environments, only perform re-writing
 * if the host, port, or scheme are different than https://browserid.org:443
 * (all source files always should have the production hostname written into them)
 */
exports.performSubstitution = function(app) {
  if (g_config['URL'] != 'https://browserid.org') {
    app.use(postprocess.middleware(function(req, buffer) {
      return buffer.toString().replace(new RegExp('https://browserid.org', 'g'), g_config['URL']);
    }));
  }
};

g_config['express_log_format'] = (exports.get('env') === 'production' ? 'default' : 'dev');

// At the time this file is required, we'll determine the "process name" for this proc
// if we can determine what type of process it is (browserid or verifier) based
// on the path, we'll use that, otherwise we'll name it 'ephemeral'.
g_config['process_type'] = path.basename(process.argv[1], ".js");

// only allow the dbwriter process to write to the database (or the unit tests)
g_config.database.may_write = (g_config.process_type === 'dbwriter' ||
                               g_config.process_type === 'vows' ||
                               g_config.process_type === 'db-test');

// log the process_type
setTimeout(function() {
  require("./logging.js").logger.info("process type is " + g_config["process_type"]);
}, 0);
