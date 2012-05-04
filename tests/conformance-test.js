#!/usr/bin/env node
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
vows = require('vows'),
assert = require('assert'),
path = require('path'),
jwcrypto = require('jwcrypto');

require("jwcrypto/lib/algs/rs");
require("jwcrypto/lib/algs/ds");

var suite = vows.describe('Conformance Tests');

var domainKeypair;
var userKeypair;

suite.addBatch({
  "generate a keypair": {
    topic: function() {
      jwcrypto.generateKeypair({algorithm: "RS", keysize: 256}, this.callback);
    },
    "works" : function(err, kp) {
      assert.isNull(err);
      domainKeypair = kp;
    }
  }
});

suite.addBatch({
  "generate a keypair": {
    topic: function() {
      jwcrypto.generateKeypair({algorithm: "DS", keysize: 128}, this.callback);
    },
    "works" : function(err, kp) {
      assert.isNull(err);
      userKeypair = kp;
    }
  }
});

/*
 * some functions to do b64url encoding/decoding
 */
function base64urlencode(arg) {
  var s = new Buffer(arg).toString('base64'); // window.btoa(arg);
  s = s.split('=')[0]; // Remove any trailing '='s
  s = s.replace(/\+/g, '-'); // 62nd char of encoding
  s = s.replace(/\//g, '_'); // 63rd char of encoding
  // TODO optimize this; we can do much better
  return s;
}

function base64urldecode(arg) {
  var s = arg;
  s = s.replace(/-/g, '+'); // 62nd char of encoding
  s = s.replace(/_/g, '/'); // 63rd char of encoding
  switch (s.length % 4) // Pad with trailing '='s
  {
  case 0: break; // No pad chars in this case
  case 2: s += "=="; break; // Two pad chars
  case 3: s += "="; break; // One pad char
  default: throw new InputException("Illegal base64url string!");
  }
  return new Buffer(s,'base64').toString('ascii'); // window.atob(s); // Standard base64 decoder
}

var BI_RM = "0123456789abcdefghijklmnopqrstuvwxyz";
function int2char(n) { return BI_RM.charAt(n); }

var b64urlmap="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
function b64urltohex(s) {
  var ret = "";
  var i;
  var k = 0; // b64 state, 0-3
  var slop;
  for(i = 0; i < s.length; ++i) {
    var v = b64urlmap.indexOf(s.charAt(i));
    if(v < 0) continue;
    if(k == 0) {
      ret += int2char(v >> 2);
      slop = v & 3;
      k = 1;
    }
    else if(k == 1) {
      ret += int2char((slop << 2) | (v >> 4));
      slop = v & 0xf;
      k = 2;
    }
    else if(k == 2) {
      ret += int2char(slop);
      ret += int2char(v >> 2);
      slop = v & 3;
      k = 3;
    }
    else {
      ret += int2char((slop << 2) | (v >> 4));
      ret += int2char(v & 0xf);
      k = 0;
    }
  }
  if(k == 1)
    ret += int2char(slop << 2);

  // initial 0? only one for now
  if (ret[0] == '0')
    return ret.substring(1);
  else
    return ret;
}

// this function (jwcrypto.extractComponents) is copied here so that
// a change in the library doesn't mess up these conformance tests.
function extractComponents(signedObject) {
  if (typeof(signedObject) != 'string')
    throw "malformed signature " + typeof(signedObject);
  
  var parts = signedObject.split(".");
  if (parts.length != 3) {
    throw "signed object must have three parts, this one has " + parts.length;
  }    
  
  var headerSegment = parts[0];
  var payloadSegment = parts[1];
  var cryptoSegment = parts[2];  

  // we verify based on the actual string
  // FIXME: we should validate that the header contains only proper fields
  var header = JSON.parse(base64urldecode(headerSegment));
  var payload = JSON.parse(base64urldecode(payloadSegment));
  var signature = b64urltohex(cryptoSegment);

  return {header: header,
          payload: payload,
          signature: signature,
          headerSegment: headerSegment,
          payloadSegment: payloadSegment,
          cryptoSegment: cryptoSegment};
};

const AUDIENCE = "http://foobar.com";
const ISSUER = "issuer.com";
const EMAIL = "john@example.com";

var now = new Date();
var in_a_minute = new Date(new Date().valueOf() + 60000);

suite.addBatch({
  "sign an assertion": {
    topic: function() {
      jwcrypto.assertion.sign({}, {audience: AUDIENCE, expiresAt: in_a_minute},
                              userKeypair.secretKey, this.callback);
    },
    "works" : function(err, signedObject) {
      assert.isNull(err);
    },
    "has three part": function(err, signedObject) {
      assert.equal(signedObject.split(".").length, 3);
    },
    "and then parsed": {
      topic: function(signedObject) {
        return extractComponents(signedObject);
      },
      "has proper header": function(components) {
        assert.isObject(components.header);
        assert.equal(components.header.alg, 'DS128');
        assert.equal(Object.keys(components.header).length, 1);
      },
      "has proper payload": function(components) {
        assert.isObject(components.payload);
        assert.equal(components.payload.exp, in_a_minute.valueOf());
        assert.equal(components.payload.aud, AUDIENCE);

        // nothing else
        assert.equal(Object.keys(components.payload).length, 2);
      },
      "has proper signature": function(components) {
        assert.isString(components.signature);

        // 160 bits for r and s, 320 bits together, 80 hex chars
        // but because of encoding, leading 0s may have gotten removed
        // likelihood of X zeros, 1/(2^(4X))
        // let's allow for up to 5 zeros.
        assert.ok(components.signature.length <= 80);
        assert.ok(components.signature.length > 75);        
      }
    }
  }
});

suite.addBatch({
  "sign a cert": {
    topic: function() {
      jwcrypto.cert.sign(userKeypair.publicKey, {email: EMAIL},
                         {issuedAt: now, issuer: ISSUER, expiresAt: in_a_minute},
                         {},
                         domainKeypair.secretKey, this.callback);
    },
    "works" : function(err, signedObject) {
      assert.isNull(err);
    },
    "has three parts": function(err, signedObject) {
      assert.equal(signedObject.split(".").length, 3);
    },
    "and then parsed": {
      topic: function(signedObject) {
        return extractComponents(signedObject);
      },
      "has proper header": function(components) {
        assert.isObject(components.header);
        assert.equal(components.header.alg, 'RS256');
        assert.equal(Object.keys(components.header).length, 1);
      },
      "has proper payload": function(components) {
        assert.isObject(components.payload);
        assert.equal(components.payload.iss, ISSUER);
        assert.equal(components.payload.exp, in_a_minute.valueOf());
        assert.equal(components.payload.iat, now.valueOf());

        assert.isObject(components.payload.principal);
        assert.equal(components.payload.principal.email, EMAIL);
        assert.equal(Object.keys(components.payload.principal).length, 1);

        assert.equal(JSON.stringify(components.payload['public-key']), userKeypair.publicKey.serialize());

        // nothing else
        assert.equal(Object.keys(components.payload).length, 5);
      },
      "has proper signature": function(components) {
        assert.isString(components.signature);

        // 2048 bits = 512 hex chars, but could be less. Though very unlikely
        // to be less than 32 bits less :)
        assert.ok(480 < components.signature.length);
        assert.ok(components.signature.length <= 512);
      }
    }
  }
});

/*
 * and the vectors
 */

var VECTORS = [
  {
    assertion: "eyJhbGciOiJSUzI1NiJ9.eyJpc3MiOiIxMjcuMC4wLjEiLCJleHAiOjEzMzU1NjI2OTg3NjgsImlhdCI6MTMzNTU1OTA5ODc2OCwicHVibGljLWtleSI6eyJhbGdvcml0aG0iOiJEUyIsInkiOiIyN2Y2OTgzMWIzNzdlMmY1NzRiZGE5Njg1YWJmNTM5OTY1ZDAyNDI2Mjg0ZDZmYzViOWVkMjA0MzJmN2U5Yjg1YTFjMjJiMTQ2M2I0NmQwMzljMTIzOWJkZWI2NDc1ZDZjMDM0MWJlZmRiYzBjYjJmMjQ4MTUzYjRjMzFkZDMxNWFjZjFkZmY0ZWUwYmY2NGY4OTUyN2VlMTlmNTkxNTM3NWFjZTNkNTZjMWQ1NDUzY2FjNmRkMTE4NzU3NTI3MmRhYjBlZGQzMGYxYjRlOTI2Yzg3YTNlNGFjYWY2NmY5MmZlZDFhMDRhYjI3Y2NjNDkxM2FmZTI0ZGRjZjNmZTk4IiwicCI6ImZmNjAwNDgzZGI2YWJmYzViNDVlYWI3ODU5NGIzNTMzZDU1MGQ5ZjFiZjJhOTkyYTdhOGRhYTZkYzM0ZjgwNDVhZDRlNmUwYzQyOWQzMzRlZWVhYWVmZDdlMjNkNDgxMGJlMDBlNGNjMTQ5MmNiYTMyNWJhODFmZjJkNWE1YjMwNWE4ZDE3ZWIzYmY0YTA2YTM0OWQzOTJlMDBkMzI5NzQ0YTUxNzkzODAzNDRlODJhMThjNDc5MzM0MzhmODkxZTIyYWVlZjgxMmQ2OWM4Zjc1ZTMyNmNiNzBlYTAwMGMzZjc3NmRmZGJkNjA0NjM4YzJlZjcxN2ZjMjZkMDJlMTciLCJxIjoiZTIxZTA0ZjkxMWQxZWQ3OTkxMDA4ZWNhYWIzYmY3NzU5ODQzMDljMyIsImciOiJjNTJhNGEwZmYzYjdlNjFmZGYxODY3Y2U4NDEzODM2OWE2MTU0ZjRhZmE5Mjk2NmUzYzgyN2UyNWNmYTZjZjUwOGI5MGU1ZGU0MTllMTMzN2UwN2EyZTllMmEzY2Q1ZGVhNzA0ZDE3NWY4ZWJmNmFmMzk3ZDY5ZTExMGI5NmFmYjE3YzdhMDMyNTkzMjllNDgyOWIwZDAzYmJjNzg5NmIxNWI0YWRlNTNlMTMwODU4Y2MzNGQ5NjI2OWFhODkwNDFmNDA5MTM2YzcyNDJhMzg4OTVjOWQ1YmNjYWQ0ZjM4OWFmMWQ3YTRiZDEzOThiZDA3MmRmZmE4OTYyMzMzOTdhIn0sInByaW5jaXBhbCI6eyJlbWFpbCI6ImJlbkBhZGlkYS5uZXQifX0.MklRRWfQweUwYR2crhFU2EuLyUOZlpY4zJgg9LSWDF1MQIGJtNZAclB_tU4sNWfWyrHBa6ICXGfT9mMbkWwPIZC714clAkCMAQXiL2FhuzZSHlnYRO0_BFLO0LqtxIbwdGAQ0WvmaS5lPCgwHdoJbIHPVupebT1C-nUUu21pBoFI_8sPjzINwGBlE6K6WQQy0KbF2m0VDZY5EAYa4mh4o84xiABCoYZYSEeA9FIzmYRJEVrqYHjQeVucZdqkDDCTEK49nVIR4hi8Mm1EItYDn__HDydZORotzfOHuLmB9xyVgBX_tcKJ9mND7MQJVeOumhDAx9QyXtRUhPhKUTDNgA~eyJhbGciOiJEUzEyOCJ9.eyJleHAiOjEzMzU1NTk0MTU3MzMsImF1ZCI6Imh0dHA6Ly9sb2NhbGhvc3Q6MTAwMDEifQ.BBoFaSGq0UAYDi9vdbsoBegeJ7FHVDxzODiV8MD8pF0emOPp1i_Uzg",
    root: {"algorithm":"RS","n":"13717766671510433111303151806101127171813773557424962001210686599690717644398501153133960329815327700526221729490916021955004415636643109524427762578738613915853895591332921269523141755077814022043323454871557827878869765578483437974192481801184235473918125161566266295979176194039841474030846700306142580608077665527626562098429368267997746767380874004089196208403356658867000112308693077043530239627194850786092251128137244380236693014852428390414510793421293487373711079360003639159681004539188014924495483277607084448583613608953997565952445532663265804891482606228128383798830560843667395414521699843061983900619","e":"65537"}
  }
];

var assertion = VECTORS[0].assertion;
var pk = jwcrypto.loadPublicKeyFromObject(VECTORS[0].root);
var now = new Date();

// times
var timeOfCert = 1335562698768;
var timeOfAssertion = 1335559415733;

// a bit before both cert and assertion
var timeThatShouldWork = new Date(Math.min(timeOfCert, timeOfAssertion) - 1000);

suite.addBatch(
  {
    "verifying a test-vector assertion that is expired" : {
      topic: function() {
        jwcrypto.cert.verifyBundle(
          assertion, now, function(issuer, next) {
            process.nextTick(function() {next(null, pk);});
          },
          this.callback);
      },
      "fails appropriately": function(err, certParamsArray, payload, assertionParams) {
        assert.equal(err, "assertion has expired");
      }
    }    
});

suite.addBatch(
  {
    "verifying a test-vector assertion with appropriate verif time" : {
      topic: function() {
        jwcrypto.cert.verifyBundle(
          assertion, timeThatShouldWork, function(issuer, next) {
            process.nextTick(function() {next(null, pk);});
          },
          this.callback);
      },
      "succeed": function(err, certParamsArray, payload, assertionParams) {
        assert.isNull(err);
      }
    }    
});

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
