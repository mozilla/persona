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
* bug garage:
*
* attribute name "valid-until" has hyphens, which is annoying
*
*/

const jwt = require('./jwt.js');
const xml2js = require("xml2js/lib/xml2js");
const http = require("http");
const https = require("https");
const url = require("url");
const rsa = require("./rsa.js");
const logger = require("../../libs/logging.js").logger;

// configuration information to check the issuer
const config = require("../../libs/configuration.js");

var Webfinger = (function() {

  // contains domain to template string
  var hostMetaCache = {};
  var NO_HOST_META = "NO";
  
  function extractLRDDTemplateFromHostMeta(docBytes, domain)
  {
    var parser =new xml2js.Parser();
    var retval;
    parser.addListener('end', function(parsedDoc) {

      // XX Okay, really need to use a namespace-aware parser here!
      // This is nasty.
      var host = parsedDoc["hm:Host"];
      if (!host) {
        host = parsedDoc["Host"]; // hm, well, try it without a namespace
        if (!host) {
          throw {error:"Unable to find a Host element in the host-meta file for " + domain};
        }
      }

      var links = parsedDoc["Link"];
      if (links instanceof Array) {
        for (var i in links) {
          var link = links[i];
          var rel = link["@"]["rel"];
          if (rel) {
            if (rel.toLowerCase() == "lrdd") {
              var template = link["@"]["template"];
              retval = template;
              break;
            }
          }  
        }
      } else {
        var rel = links["@"]["rel"];
        if (rel) {
          if (rel.toLowerCase() == "lrdd") {
            var template = links["@"]["template"];
            retval = template;
          }
        }  
      }	
    });
    parser.parseString(docBytes);
    return retval;
  }

  function retrieveTemplateForDomain(domain, continueFn, errorFn)
  {
    if (hostMetaCache[domain]) {
      if (hostMetaCache[domain] == NO_HOST_META) {
        logger.info("HostMeta cache hit (negative) for " + domain);
        errorFn("NoHostMeta");
      } else {
        logger.info("HostMeta cache hit (positive) for " + domain);
        continueFn(hostMetaCache[domain]);
      }
    }
    else
    {
      var hostmetaURL = domain + "/.well-known/host-meta";
      var domainSplit = domain.split(":");
      var options = {
        host: domainSplit[0],
        port: (domainSplit.length > 1) ? parseInt(domainSplit[1]) : 80,
        path: '/.well-known/host-meta',
        method: 'GET',
        headers: { "Host": domain}
      };
      try {
        logger.info("Requesting host-meta for " + options.host + ":" + options.port + " (" + domain + ")");

        var scheme = ((options.port == 443) ? https : http);
        var req = scheme.request(options, function(res) {
          res.setEncoding('utf8');
          var buffer = "";
          var offset = 0;
          res.on('data', function (chunk) {
            buffer += chunk;
            offset += chunk.length;
          });
          res.on('end', function() {          
            try {
              var template = extractLRDDTemplateFromHostMeta(buffer, domain);
              hostMetaCache[domain] = template;
              continueFn(template);
            } catch(e) {
              errorFn(e);
            }
          });
          res.on('error', function(e) {
            logger.warn("Webfinger error: "+ e + "; " + e.error);
            hostMetaCache[domain] = NO_HOST_META;
            errorFn(e);        
          });
        });
        req.end();
      } catch (e) {
        errorFn(e);              
      }
    }
  }

  function resolvePublicKeysForAddress(addr, issuer, successCallback, errorCallback)
  {
    var domain = undefined;
    if (typeof issuer === 'string') {
      domain = issuer;
    } else {
      var split;
      try { split = addr.split("@"); } catch(e) { }
      if (split.length != 2) {
        logger.warn("Cannot parse " + addr + " as an email address");
        errorCallback({message:"Cannot parse input as an email address"});
        return;
      };
      domain = split[1];
    }

    logger.info("Verifier: resolving public key for address " +addr + "; issuer " + issuer);

    retrieveTemplateForDomain(
      domain, 
      function gotTemplate(template)
      {
        var userXRDURL = null;
        if (template) userXRDURL = template.replace("{uri}", encodeURI(addr));
        if (userXRDURL == null) {
          errorCallback({message:"" + domain + " does not support webfinger (no Link with an lrdd rel and template attribute)"});
          return;
        }

        var parsedurl = url.parse(userXRDURL);
        var options = {
          host: parsedurl.hostname,
          port: parsedurl.port,
          path: parsedurl.pathname,
          method: 'GET',
          headers: { "Host": parsedurl.host}
        };

        var scheme = ((parsedurl.protocol == 'https:') ? https : http);

        var req = scheme.request(options, function(res) {
          res.setEncoding('utf8');
          var buffer = "";
          var offset = 0;
          res.on('data', function (chunk) {
            buffer += chunk;
            offset += chunk.length;
          });
          res.on('end', function() {

            var parser =new xml2js.Parser();
            var publicKeys = [];
            parser.addListener('end', function(parsedDoc) {

              var linkList = parsedDoc["Link"];
              if (!(linkList instanceof Array)) linkList = [linkList];

              for (var i=0;i<linkList.length;i++)
              {
                var link = linkList[i];
                var rel = link["@"]["rel"];

                if (rel == "public-key") {
                  var val = link["@"]["value"];
                  var id = link["@"]["id"];
                  if (val) {
                    var keyObj = { key: val };
                    if (id) keyObj.keyid = id;
                    publicKeys.push(keyObj);
                  }
                }
              }
            });
            parser.parseString(buffer);
            successCallback(publicKeys);
          });
          res.on('error', function(e) {
            logger.warn("Unable to retrieve template for domain " + domain);
            errorCallback({message:"Unable to retrieve the template for the given domain."});
          });
        });
        req.end();
      }, 
      function gotError(e) {
        logger.warn("Unable to retrieve template for domain " + domain);
        errorCallback({message:"Unable to retrieve the template for the given domain."});
      });
  }
  
  function simulateNetwork(hostTable) {
    simulatedNetwork = hostTable;
  } 
  
  return {
    resolvePublicKeysForAddress : resolvePublicKeysForAddress,
    simulateNetwork: simulateNetwork
  };
})();


function IDAssertionException(message)
{
  return {
    message:message
  };
}

function IDAssertion(assertion)
{
  this.assertion = assertion;
}

IDAssertion.prototype  =
{
  verify: function(forAudience, onSuccess, errorCallback)
  {
    function onError(msg) {
      // log at info level here, assertion failure is somewhat common
      // and not necessarily a bug.
      logger.info("verification failed: " + msg);
      errorCallback(msg);
    }

    // Assertion should be a JWT.
    var token = jwt.WebTokenParser.parse(this.assertion);
    
    // JWT will look like:
    // <algorithm-b64>.<payload-b64>.<signature-b64>
    //
    // payload will look like
    // {audience: <>, valid-until:<>, email: <>}
    var decoded = jwt.base64urldecode(token.payloadSegment);
    var payload = JSON.parse(decoded);

    if (!payload.email) {
      onError("Payload is missing required email.");
      return;
    }
    if (!payload.audience) {
      onError("Payload is missing required audience.");
      return;
    }
    if (payload.audience !== forAudience) {
      onError("Payload audience does not match provided audience.");
      return;
    }
    if (!payload["valid-until"]) {
      onError("Payload is missing required valid-until.");
      return;
    }
    var validUntil = new Date(payload["valid-until"]);
    if (validUntil < new Date()) {
      onError("Payload has expired.");
      return;
    }

    // check that the issuer is just US for now, no other issuer
    // FIXME: this will need to change for certs
    var expected_issuer = config.get('hostname') + ':' + config.get('port');
    if (payload.issuer != expected_issuer) {
      onError("Issuer can only be ourselves for now, it should be: " + expected_issuer);
      return;
    }
    
    // (if there was a certificate, we could verify it here)
    // but for now we will assume email-based lookup
    
    Webfinger.resolvePublicKeysForAddress(
      payload.email,
      payload.issuer,
      function(publicKeys)
      {
        if (publicKeys.length == 0) {
          onError("Email address had no public keys");
          return;
        }
        
        // In the absence of a key identifier, we need to check them all.
        for (var i=0;i<publicKeys.length;i++)
        {
          try {
            var pubKey = new rsa.RSAKey();
            pubKey.readPublicKeyFromPEMString(publicKeys[i].key);
            if (token.verify(pubKey)) {
              // success!
              logger.info("Token for " +payload.email + " verified successfully.");

              // send back all the verified data
              onSuccess(payload);
              return;
            }
          } catch(e) {
            logger.warn("failed to parse public key: " + e);
          }
        }
        onError("None of the user's public keys verified the signature");
      },
      onError);
  }
}

exports.IDAssertion = IDAssertion;
