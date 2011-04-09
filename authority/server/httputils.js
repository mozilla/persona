// various little utilities to make crafting boilerplate responses
// simple

exports.fourOhFour = function(resp, reason)
{
  resp.writeHead(404, {"Content-Type": "text/plain"});
  resp.write("Not Found");
  if (reason) {
    resp.write(": " + reason);
  }
  resp.end();
};

exports.badRequest = function(resp, reason)
{
  resp.writeHead(400, {"Content-Type": "text/plain"});
  resp.write("Bad Request");
  if (reason) {
    resp.write(": " + reason);
  }
  resp.end();
};

exports.jsonResponse = function(resp, obj)
{
  resp.writeHead(200, {"Content-Type": "application/json"});
  if (obj) resp.write(JSON.stringify(obj));
  resp.end();
};

exports.checkGetArgs = function(req, args) {
    [ "email", "pass", "pubkey" ].forEach(function(k) {
      if (!urlobj.hasOwnProperty(k) || typeof urlobj[k] !== 'string') {
        throw k;
      }
    });

};