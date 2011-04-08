/*
* bug garage:
*
* attribute name "valid-until" has hyphens, which is annoying
*
*/


var Webfinger = (function() {

  if (!console) console = {};
  if (!console.log) console.log=function(x) {}

  // contains domain to template string
  var hostMetaCache = {};
  var NO_HOST_META = "NO";
  
  function extractLRDDTemplateFromHostMetaDOM(parsedDoc, progressFn)
  {
    if (parsedDoc.documentElement.nodeName == "parsererror") {
      throw {
        error:"Unable to parse host-meta file for " + domain
      };
    }
    var host = parsedDoc.documentElement.getElementsByTagNameNS("http://host-meta.net/xrd/1.0", "Host");
    if (!host || host.length == 0) {
      host = parsedDoc.documentElement.getElementsByTagName("Host"); // hm, well, try it without a namespace
      if (!host || host.length == 0) {
        throw {error:"Unable to find a Host element in the host-meta file for " + domain};
      }
    }

    var links = parsedDoc.documentElement.getElementsByTagName("Link")
    var userXRDURL = null;
    for (var i in links) {
      var link = links[i];
      var rel = link.getAttribute("rel");
      if (rel) {
        if (rel.toLowerCase() == "lrdd") {
          var template = link.getAttribute("template");
          return template;
        }
      }  
    }	
    return null;
  }

  function retrieveTemplateForDomain(domain, continueFn, errorFn)
  {
    if (hostMetaCache[domain]) {
      if (hostMetaCache[domain] == NO_HOST_META) {
        console.log("HostMeta cache hit (negative) for " + domain);
        errorFn("NoHostMeta");
      } else {
        console.log("HostMeta cache hit (positive) for " + domain);
        continueFn(gHostMetaCache[domain]);
      }
    }
    else
    {
      var hostmetaURL = "http://" + domain + "/.well-known/host-meta";
      var xhr = new XMLHttpRequest();
      xhr.open('GET', hostmetaURL, true);
      console.log("Making hostmeta request to " + hostmetaURL);

      xhr.onreadystatechange = function (aEvt) {
        console.log("xhr change: " + xhr.readyState);
        if (xhr.readyState == 4) {
          try {
            if (xhr.status != 200) {
              console.log("Status " + xhr.status + " (" + xhr.statusCode + ") accessing " + hostmetaURL);
              errorFn(""+domain + " does not support webfinger (error " + xhr.status + " contacting server).");
              return;
            }
            console.log("Loaded hostmeta for " + domain + "\n");
            var template = extractLRDDTemplateFromHostMetaDOM(xhr.responseXML);
            hostMetaCache[domain] = template;
            console.log("Got template for " + domain);
            continueFn(template);
          } catch (e) {
            console.log("Webfinger: "+ e + "; " + e.error);
            hostMetaCache[domain] = NO_HOST_META;
            errorFn(e);
          }
        }
      }
      xhr.send(null);
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
        console.log("Got template for " + domain);
      
        var userXRDURL = null;
        if (template) userXRDURL = template.replace("{uri}", encodeURI(addr));
        if (userXRDURL == null) {
          errorCallback({message:"" + domain + " does not support webfinger (no Link with an lrdd rel and template attribute)"});
          return;
        }
        console.log("Constructed user path " + userXRDURL);

        var xrdLoader = new XMLHttpRequest();
        xrdLoader.open('GET', userXRDURL, true);
        xrdLoader.onreadystatechange = function (aEvt) {
          if (xrdLoader.readyState == 4) {
            if (xrdLoader.status == 200) {

              console.log("Got user data");

              var dom = xrdLoader.responseXML;
              var linkList = dom.documentElement.getElementsByTagName("Link");
            
              var publicKeys = [];
              for (var i=0;i<linkList.length;i++)
              {
                var link = linkList[i];
                var rel = link.attributes.rel;
                
                console.log("Got link " + i + "; rel is " + rel.value);
                if (rel.value == "public-key") {
                  var val = link.attributes.value;
                  var id = link.attributes.id;
                  if (val) {
                    var keyObj = { key: val.value };
                    if (id) keyObj.keyid = link.attributes.id.value;
                    publicKeys.push(keyObj);
                  }
                }
              }
            }
            console.log("Got public keys " + JSON.stringify(publicKeys));
            successCallback(publicKeys);
          }
        }
        xrdLoader.send(null);
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
    var payload = JSON.parse(window.atob(token.payloadSegment));
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
          var pubKey = new RSAKey();
          pubKey.setPublic(rsPubKeyModulus, rsPubKeyExponent);
          if (token.verify(publicKeys[i])) {
            // success!
            console.log("Token for " +payload.email + " verified successfully.");
            onSuccess(true);
            return;
          }
        }
        onError("None of the users public keys verified the signature");
      },
      function(error) {
        onError(error);
      });
  }
}