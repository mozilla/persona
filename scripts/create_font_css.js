#!/usr/bin/env node
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


const
fs = require("fs"),
path = require('path'),
resources = require('../lib/static_resources.js'),
templates = require('../lib/templates'),
cachify = require('connect-cachify'),
connect_fonts = require('connect-fonts'),
connect_fonts_opensans = require('connect-fonts-opensans'),
connect_fonts_feurasans = require('connect-fonts-feurasans'),
config = require('../lib/configuration'),
mkdirp = require('mkdirp');

var dir = process.cwd();
var output_dir = process.env.BUILD_DIR || dir;

connect_fonts.setup({
  fonts: [ connect_fonts_opensans, connect_fonts_feurasans ],
  "allow-origin": config.get('public_url')
});

function generateCSS() {
  var langs = config.get('supported_languages');
  var all = resources.all(langs);

  for (var key in all) {
    if (/\.css$/.test(key)) {
      var deps = all[key];

      deps.forEach(function(dep) {
        if (/fonts\.css$/.test(dep)) {
          var parts = dep.split('/');
          var lang = parts[1];
          var fonts = parts[2].split(',');
          var ua = "all";

          connect_fonts.generate_css(ua, lang, fonts, function(err, css) {
            var css_output_path = path.join(output_dir, dep);
            var css_output_dir = path.dirname(css_output_path);

            // create any missing directories.
            mkdirp.sync(css_output_dir);

            // finally, write out the file.
            fs.writeFileSync(css_output_path, css.css, "utf8");
          });
        }
      });
    }
  }
}

// run or export the function
if (process.argv[1] === __filename) generateCSS();
else module.exports = generateCSS;
