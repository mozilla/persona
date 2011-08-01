// return a function that is substitution middleware, capable
// of being installed to perform textual replacement on
// all server output
exports.substitute = function(subs) {
  // given a buffer, find and replace all subs
  function subHostNames(data) {
    for (var i in subs) {
      data = data.toString().replace(new RegExp(i, 'g'), subs[i]);
    }

    return data;
  }

  return function(req, resp, next) {
    // cache the *real* functions
    var realWrite = resp.write;
    var realEnd = resp.end;
    var realWriteHead = resp.writeHead;
    var realSend = resp.send;

    var buf = undefined;
    var enc = undefined;
    var contentType = undefined;

    resp.writeHead = function (sc, reason, hdrs) {
      var h = undefined;
      if (typeof hdrs === 'object') h = hdrs;
      else if (typeof reason === 'object') h = reason; 
      for (var k in h) {
        if (k.toLowerCase() === 'content-type') {
          contentType = h[k];
          break;
        }
      }
      if (!contentType) contentType = resp.getHeader('content-type');
      if (!contentType) contentType = "application/unknown";
      realWriteHead.call(resp, sc, reason, hdrs);
    };

    resp.write = function (chunk, encoding) {
      if (buf) buf += chunk;
      else buf = chunk;
      enc = encoding;
    };

    resp.send = function(stuff) {
      buf = stuff;
      realSend.call(resp,stuff);
    };

    resp.end = function() {
      if (!contentType) contentType = resp.getHeader('content-type');
      if (contentType && (contentType === "application/javascript" ||
                          contentType.substr(0,4) === 'text'))
      {
        if (buf) {
          if (Buffer.isBuffer(buf)) buf = buf.toString('utf8');
          var l = Buffer.byteLength(buf);
          buf = subHostNames(buf);
          if (l != Buffer.byteLength(buf)) resp.setHeader('Content-Length', Buffer.byteLength(buf));
        }
      }
      if (buf && buf.length) {
        realWrite.call(resp, buf, enc);
      }
      realEnd.call(resp);
    }

    next();
  };
};
