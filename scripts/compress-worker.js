const
fs = require('fs'),
jsp = require("uglify-js").parser,
pro = require("uglify-js").uglify,
uglifycss = require('uglifycss'),
mkdirp = require('mkdirp'),
path = require('path');

function compressResource(staticPath, name, files, cb) {
  var orig_code = "";
  var info = undefined;
  function writeFile(final_code) {
    mkdirp(path.join(staticPath, path.dirname(name)), function (err) {
      if (err) cb(err);
      else {
        fs.writeFile(path.join(staticPath, name), final_code, function(err) {
          cb(err, info);
        });
      };
    });
  }

  function compress() {
    try {
      var final_code;
      if (/\.js$/.test(name)) {
        // compress javascript
        var ast = jsp.parse(orig_code); // parse code and get the initial AST
        ast = pro.ast_mangle(ast); // get a new AST with mangled names
        ast = pro.ast_squeeze(ast); // get an AST with compression optimizations
        final_code = pro.split_lines(pro.gen_code(ast), 32 * 1024); // compressed code here
      } else if (/\.css$/.test(name)) {
        // compress css
        final_code = uglifycss.processString(orig_code);
      } else {
        return cb("can't determine content type: " + name);
      }
      writeFile(final_code);
    } catch(e) {
      cb("error compressing: " + e.toString() + "\n");
    }
  }

  function readNext() {
    if (files.length) {
      var f = files.shift();
      fs.readFile(path.join(staticPath, f), function(err, data) {
        if (err) cb(err);
        else {
          orig_code += data;
          readNext();
        }
      });
    } else {
      compress();
    }
  }

  function isBuildNeeded() {
    // we'll check mtime on all files.  if any is newer than the output file,
    // build is needed
    try {
      var lastGen = fs.statSync(path.join(staticPath, name)).mtime;
      for (var i = 0; i < files.length; i++) {
        if (lastGen < fs.statSync(path.join(staticPath, files[i])).mtime) {
          info = "rebuilt because " + files[i] + " was changed";
          throw "newer";
        }
      };
      // no rebuild needed
      cb(null, "up to date");
    } catch (e) {
      readNext();
    }

  }

  isBuildNeeded();
}

process.on('message', function(m) {
  var startTime = new Date;

  compressResource(m.staticPath, m.file, m.deps, function(err, info) {
    if (err) process.send({ error: err });
    else process.send({
      time: ((new Date - startTime) / 1000.0).toFixed(2),
      info: info
    });
  });
});