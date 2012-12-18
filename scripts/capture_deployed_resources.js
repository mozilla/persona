#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * This is a utility that captures the current state of the resources on the
 * production data-centers. This data is useful for a post-mortem when the
 * exact state of the front-end resources is needed.
 *
 * An IP address of a server can be specified on the command line by using the
 * IP_ADDRESS environment variable. example:
 *
 *   IP_ADDRESS=52.242.202.29 node ./capture_deployed_resources.js
 *
 * Data is stored into <browserid_root>/var/capture/<ip_address>@<timestamp>
 */

const path                 = require('path'),
      fs                   = require('fs'),
      mkdirp               = require('mkdirp'),
      https                = require('https'),
      // TODO - externalize the config - but to where?
      ipAddresses          = process.env.IP_ADDRESS ? [ process.env.IP_ADDRESS ] : ['63.245.209.241', '63.245.217.134'],
      resources = [
        '/include.js',
        '/authentication_api.js',
        '/ver.txt',
        '/humans.txt',
        // main site
        '/',
        '/signin',
        '/about',
        '/privacy',
        '/tos',
        '/communication_iframe',
        '/production/communication_iframe.js',
        '/unsupported_dialog',
        '/cookies_disabled',
        '/relay',
        '/production/relay.js',
        '/authenticate_with_primary',
        '/production/authenticate_with_primary.js',
        '/idp_auth_complete',
        '/forgot',
        '/verify_email_address',
        '/add_email_address',
        '/reset_password',
        '/confirm',
        '/production/browserid.css',
        '/production/ie8_main.css',
        '/production/en/browserid.js',
        // dialog
        '/sign_in',
        '/production/html5shim.js',
        '/production/dialog.css',
        '/production/ie8_dialog.css',
        '/production/en/dialog.js'
      ],
      outputDir            = path.join(__dirname, "..", "var", "capture"),
      startTime            = (new Date()).toISOString();


ipAddresses.forEach(function(ipAddress) {
  var serverOutputDir = path.join(outputDir, ipAddress + '@' + startTime);
  mkdirp(serverOutputDir, function(err) {
    if (err) return err;

    resources.forEach(function(resource) {
      var url = "https://" + ipAddress + resource;
      https.get(url, function(res) {
        var buffer = "";

        res.on('data', function(d) {
          buffer += d.toString();
        });

        res.on('end', function() {
          var basename = path.basename(resource) || "index";
          var resourceOutputPath = path.join(serverOutputDir, "/", basename);
          console.log("writing", resourceOutputPath);
          fs.writeFile(resourceOutputPath, buffer, 'utf8');
        });
      });
    });
  });
});


