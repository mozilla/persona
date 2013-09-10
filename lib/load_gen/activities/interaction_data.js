/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * this file is the "interaction_data" activity, which simulates 
 * the load of the client passing on interaction data for kpi metrics */

const
client = require('../../wsapi_client.js'),
common = require('../common');

var blob = { data: 
  { "event_stream":[["window.dom_loading",972],
                    ["window.channel_established",2720],
                    ["screen.rp_info",2721],
                    ["xhr_complete.GET/wsapi/session_context",2723,294],
                    ["screen.authenticate",3032],["user.can_interact",3053],
                    ["xhr_complete.POST/wsapi/interaction_data",3025,271],
                    ["xhr_complete.GET/wsapi/address_info",8656,603],
                    ["authenticate.enter_password",9548],
                    ["authenticate.enter_password",9554],
                    ["authenticate.enter_password",9560],
                    ["authenticate.password_submitted",15381],
                    ["xhr_complete.POST/wsapi/authenticate_user",15381,1545],
                    ["xhr_complete.GET/wsapi/list_emails",16930,255],
                    ["authenticate.password_success",17195],
                    ["screen.is_this_your_computer",17199],
                    ["xhr_complete.POST/wsapi/prolong_session",19812,245],
                    ["generate_assertion",20064],
                    ["screen.generate_assertion",20065],
                    ["xhr_complete.POST/wsapi/cert_key",20140,3580],
                    ["assertion_generated",23761],
                    ["window.unload",25564]],
    "sample_rate":1,
    "timestamp":1361407200000,
    "lang":"en",
    "new_account":false,
    "screen_size":{"width":1680,"height":1050},
    "number_emails":1,
    "number_sites_signed_in":1,
    "number_sites_remembered":1,
    "orphaned":false,
    "user_agent":{"os":"Macintosh","browser":"Firefox","version":18}}
};

exports.startFunc = function(cfg, cb) {
  client.post(cfg, '/wsapi/interaction_data', {}, blob, function(err, r) {
    err = common.checkResponse(err, r);
    if (err) return cb(err);
    if (r.body.success !== true) {
      return cb(common.error("interaction_data post not successful", null, r));
    }
    cb();
  });
};
