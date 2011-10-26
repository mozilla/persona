/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Mozilla BrowserID.
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

/*
 * An abstraction which contains various pre-set deployment
 * environments and adjusts runtime configuration appropriate for
 * the current environmnet (specified via the NODE_ENV env var)..
 *
 * usage is
 *   exports.configure(app);
 */

const
substitution = require('./substitute.js'),
path = require('path');

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
  hostname: 'browserid.org',
  port: '443',
  scheme: 'https',
  use_minified_resources: true,
  var_path: '/home/browserid/var/',
  database: {
    driver: "mysql",
    user: 'browserid',
    create_schema: true
  },
  bcrypt_work_factor: 12,
  authentication_duration_ms: (7 * 24 * 60 * 60 * 1000),
  certificate_validity_ms: (24 * 60 * 60 * 1000)
};

// beta (diresworb.org) the only difference from production 
// is the hostname
g_configs.beta = JSON.parse(JSON.stringify(g_configs.production));
g_configs.beta.hostname = 'diresworb.org';

// development (dev.diresworb.org) the only difference from production 
// is, again, the hostname
g_configs.development = JSON.parse(JSON.stringify(g_configs.production));
g_configs.development.hostname = 'dev.diresworb.org';

// local development configuration
g_configs.local =  {
  hostname: '127.0.0.1',
  port: '10002',
  scheme: 'http',
  email_to_console: true, // don't send email, just dump verification URLs to console.
  use_minified_resources: false,
  var_path: path.join(__dirname, "..", "var"),
  database: { driver: "json" },
  bcrypt_work_factor: g_configs.production.bcrypt_work_factor,
  authentication_duration_ms: g_configs.production.authentication_duration_ms,
  certificate_validity_ms: g_configs.production.certificate_validity_ms
};

if (undefined !== process.env['NODE_EXTRA_CONFIG']) {
  var fs = require('fs');
  eval(fs.readFileSync(process.env['NODE_EXTRA_CONFIG']) + '');
}

Object.keys(g_configs).forEach(function(config) {
  if (!g_configs[config].smtp) {
    g_configs[config].smtp = {
      host: process.env['SMTP_HOST'],
      user: process.env['SMTP_USER'],
      pass: process.env['SMTP_PASS']
    };
  }
});

// test environments are variations on local
g_configs.test_json = JSON.parse(JSON.stringify(g_configs.local));
g_configs.test_json.database = { driver: "json", unit_test: true }; 

g_configs.test_mysql = JSON.parse(JSON.stringify(g_configs.local));
g_configs.test_mysql.database = { driver: "mysql", user: "test", unit_test: true }; 

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
 * handled at a higher level.  For other environments, only perform re-writing
 * if the host, port, or scheme are different than https://browserid.org:443
 * (all source files always should have the production hostname written into them)
 */
exports.performSubstitution = function(app) {
  if ((g_config.hostname != 'browserid.org' || g_config.port != '443' || g_config.scheme != 'https') &&
      process.env['NODE_ENV'] !== 'local'){
    app.use(substitution.substitute({
      'https://browserid.org': g_config['URL'],
      'browserid.org:443': g_config['hostname'] + ':' + g_config['port'],
      'browserid.org': g_config['hostname']
    }));
  }
};

// At the time this file is required, we'll determine the "process name" for this proc
// if we can determine what type of process it is (browserid or verifier) based
// on the path, we'll use that, otherwise we'll name it 'ephemeral'.
if (process.argv[1] == path.join(__dirname, "..", "browserid", "run.js")) {
  g_config['process_type'] = 'browserid';
} else if (process.argv[1] == path.join(__dirname, "..", "verifier", "run.js")) {
  g_config['process_type'] = 'verifier';
} else {
  g_config['process_type'] = 'ephemeral';
}

// log the process_type
setTimeout(function() {
  require("./logging.js").logger.info("process type is " + g_config["process_type"]);
}, 0);
