exports.setup = function(app) {
  app.get("/__heartbeat__", function(req, res) {
    res.writeHead(200);
    res.write('ok');
    res.end();
  });
};
