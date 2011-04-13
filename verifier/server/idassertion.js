/*
* bug garage:
*
* attribute name "valid-until" has hyphens, which is annoying
*
*/

const jwt = require('./jwt.js');
const xml2js = require("xml2js/lib/xml2js");
const http = require("http");
const url = require("url");
const rsa = require("./rsa.js");

var Webfinger = (function() {

  if (!console) console = {};
  if (!console.log) console.log=function(x) {}

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
        console.log("HostMeta cache hit (negative) for " + domain);
        errorFn("NoHostMeta");
      } else {
        console.log("HostMeta cache hit (positive) for " + domain);
        continueFn(hostMetaCache[domain]);
      }
    }
    else
    {
      var hostmetaURL = "http://" + domain + "/.well-known/host-meta";
      var domainSplit = domain.split(":");
      var options = {
        host: domainSplit[0],
        port: (domainSplit.length > 1) ? domainSplit[1] : 80,
        path: '/.well-known/host-meta',
        method: 'GET',
        headers: { "Host": domain}
      };
      try {
        console.log("Requesting host-meta for " + options.host + ":" + options.port + " (" + domain + ")");
        var req = http.request(options, function(res) {
          res.setEncoding('utf8');
          var buffer = "";
          var offset = 0;
          res.on('data', function (chunk) {
            buffer += chunk;
            offset += chunk.length;
          });
          res.on('end', function() {          
            var template = extractLRDDTemplateFromHostMeta(buffer, domain);
            hostMetaCache[domain] = template;
            continueFn(template);
          });
          res.on('error', function(e) {
            console.log("Webfinger error: "+ e + "; " + e.error);
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

  function resolvePublicKeysForAddress(addr, successCallback, errorCallback)
  {
    var split = addr.split("@");
    if (split.length != 2) {
      console.log("Cannot parse " + addr + " as an email address");
      errorCallback({message:"Cannot parse input as an email address"});
      return;
    };
    var id = split[0];
    var domain = split[1];

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

        var req = http.request(options, function(res) {
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
                    var keyObj = { key: new Buffer(val, "base64").toString() };
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
            console.log("Unable to retrieve template for domain " + domain);
            errorCallback({message:"Unable to retrieve the template for the given domain."});

          });
        });
        req.end();
      }, 
      function gotError(e) {
        console.log("Unable to retrieve template for domain " + domain);
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
  verify: function(forAudience, onSuccess, onError)
  {
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

    // (if there was a certificate, we could verify it here)
    // but for now we will assume email-based lookup
    
    Webfinger.resolvePublicKeysForAddress(
      payload.email, 
      function(publicKeys)
      {
        if (publicKeys.length == 0) {
          onError("Email address had no public keys");
          return;
        }
        
        // In the absence of a key identifier, we need to check them all.
        for (var i=0;i<publicKeys.length;i++)
        {
          // and now, public key parse fail. :(
          var pubKey = new rsa.RSAKey();
          pubKey.readPublicKeyFromPEMString(publicKeys[i].key);
          if (token.verify(pubKey)) {
            // success!
            console.log("Token for " +payload.email + " verified successfully.");
            onSuccess(true);
            return;
          }
        }
        onError("None of the user's public keys verified the signature");
      },
      function(error) {
        onError(error);
      });
  }
}

exports.IDAssertion = IDAssertion;