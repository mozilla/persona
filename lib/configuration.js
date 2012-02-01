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
fs = require('fs'),
convict = require('convict'),
cjson = require('cjson');

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

var conf = module.exports = convict({
  env: {
    // XXX: should we deprecate this configuration paramater?
    doc: "What environment are we running in?  Note: all hosted environments are 'production'.  ",
    format: 'string ["production", "local", "test_mysql", "test_json"] = "production"',
    env: 'NODE_ENV'
  },
  bind_to: {
    host: {
      doc: "The ip address the server should bind",
      format: 'string = "127.0.0.1"',
      env: 'IP_ADDRESS'
    },
    port: {
      doc: "The port the server should bind",
      format: 'integer{1,65535}?',
      env: 'PORT'
    }
  },
  public_url: {
    doc: "The publically visible URL of the deployment",
    format: 'string = "https://browserid.org"',
    env: 'URL'
  },
  scheme: {
    // XXX should we deprecate scheme as it's redundant and derived from 'public_url' ?
    doc: "The scheme of the public URL.  Calculated from the latter.",
    format: "string",
  },
  use_minified_resources: {
    doc: "Should the server serve minified resources?",
    format: 'boolean = true',
    env: 'MINIFIED'
  },
  var_path: {
    doc: "The path where deployment specific resources will be sought (keys, etc), and logs will be kept.",
    format: 'string?',
    env: 'VAR_PATH'
  },
  database: {
    driver: 'string ["json", "mysql"] = "json"',
    user: 'string?',
    create_schema: 'boolean = true',
    may_write: 'boolean = true',
    name: {
      format: 'string?',
      env: 'DATABASE_NAME'
    }
  },
  smtp: {
    host: 'string?',
    user: 'string?',
    pass: 'string?'
  },
  statsd: {
    enabled: {
      doc: "enable UDP based statsd reporting",
      format: 'boolean = true',
      env: 'ENABLE_STATSD'
    },
    host: "string?",
    port: "integer{1,65535}?"
  },
  bcrypt_work_factor: {
    doc: "How expensive should we make password checks (to mitigate brute force attacks) ?  Each increment is 2x the cost.",
    format: 'integer{6,20} = 12',
    env: 'BCRYPT_WORK_FACTOR',
  },
  authentication_duration_ms: {
    doc: "How long may a user stay signed?",
    format: 'integer = 1209600000'
  },
  certificate_validity_ms: {
    doc: "For how long shall certificates issued by BrowserID be valid?",
    format: 'integer = 86400000'
  },
  max_compute_processes: {
    doc: "How many computation processes will be spun.  Default is good, based on the number of CPU cores on the machine.",
    format: 'union { number{1, 256}; null; } = null',
    env: 'MAX_COMPUTE_PROCESSES'
  },
  max_compute_duration: {
    doc: "What is the longest (in seconds) we'll let the user wait before returning a 503?",
    format: 'integer = 10'
  },
  disable_primary_support: {
    doc: "Disables primary support when true",
    format: 'boolean = false'
  },
  enable_code_version: {
    doc: "When enabled, will cause a 'code version' to be returned to frontend code in `/wsapi/session_context` calls",
    format: 'boolean = false'
  },
  min_time_between_emails_ms: {
    doc: "What is the most frequently we'll allow emails to be sent to the same user?",
    format: 'integer = 60000'
  },
  http_proxy: {
    port: 'integer{1,65535}?',
    host: 'string?'
  },
  default_lang: 'string = "en-US"',
  supported_languages: 'array { string }* = [ "en-US" ]',
  locale_directory: 'string = "locale"',
  express_log_format: 'string [ "default", "dev" ] = "default"',
  keysigner_url: {
    format: 'string?',
    env: 'KEYSIGNER_URL'
  },
  verifier_url: {
    format: 'string?',
    env: 'VERIFIER_URL'
  },
  dbwriter_url: {
    format: 'string?',
    env: 'DBWRITER_URL'
  },
  process_type: 'string',
  email_to_console: 'boolean = false'
});

// At the time this file is required, we'll determine the "process name" for this proc
// if we can determine what type of process it is (browserid or verifier) based
// on the path, we'll use that, otherwise we'll name it 'ephemeral'.
conf.set('process_type', path.basename(process.argv[1], ".js"));

// handle configuration files.  you can specify a CSV list of configuration
// files to process, which will be overlayed in order, in the CONFIG_FILES
// environment variable
if (process.env['CONFIG_FILES']) {
  var files = process.env['CONFIG_FILES'].split(',');
  files.forEach(function(file) {
    var c = cjson.load(file);

    // now support process-specific "overlays".  That is,
    // .browserid.port will override .port for the "browserid" process

    // first try to extract *our* overlay
    var overlay = c[conf.get('process_type')];

    // now remove all overlays from the top level config
    fs.readdirSync(path.join(__dirname, '..', 'bin')).forEach(function(type) {
      delete c[type];
    });

    // load the base config and the overlay in order
    conf.load(c);
    if (overlay) conf.load(overlay);
  });
}

// special handling of HTTP_PROXY env var
if (process.env['HTTP_PROXY']) {
  var p = process.env['HTTP_PROXY'].split(':');
  conf.set('http_proxy.host', p[0]);
  conf.set('http_proxy.port', p[1]);
}

// set the 'scheme' of the server based on the public_url (which is needed for
// things like
conf.set('scheme', urlparse(conf.get('public_url')).scheme);

// if var path has not been set, let's default to var/
if (!conf.has('var_path')) {
  conf.set('var_path', path.join(__dirname, "..", "var"));
}

// test environments may dictate which database to use.
if (conf.get('env') === 'test_json') {
  conf.set('database.driver', 'json');
} else if (conf.get('env') === 'test_mysql') {
  conf.set('database.driver', 'mysql');
}

// validate the configuration based on the above specification
conf.validate();

/*
 * Install middleware that will perform textual replacement on served output
 * to re-write urls as needed for this particular environment.
 *
 * Note, for a 'local' environment, no re-write is needed because this is
 * handled at a higher level.  For other environments, only perform re-writing
 * if the host, port, or scheme are different than https://browserid.org:443
 * (all source files always should have the production hostname written into them)
 */
module.exports.performSubstitution = function(app) {
  if (conf.get('public_url') != 'https://browserid.org') {
    app.use(postprocess.middleware(function(req, buffer) {
      return buffer.toString().replace(new RegExp('https://browserid.org', 'g'), conf.get('public_url'));
    }));
  }
};

// log the process_type
process.nextTick(function() {
  require("./logging.js").logger.info("process type is " + conf.get("process_type"));
});
