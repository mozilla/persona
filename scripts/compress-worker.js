const
cachify = require('connect-cachify'),
config = require('../lib/configuration.js'),
fs = require('fs'),
jsp = require("uglify-js").parser,
logger = require('../lib/logging.js').logger,
pro = require("uglify-js").uglify,
uglifycss = require('uglifycss'),
mkdirp = require('mkdirp'),
path = require('path');

function compressResource(staticPath, name, files, cb) {
  var orig_code = "";
  var info = undefined;

  // Cachify only used in compress for CSS Images, so no asserts needed
  cachify.setup({}, {
    prefix: config.get('cachify_prefix'),
    root: staticPath
  });
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

  function extract_copyright(code) {
    var tok = jsp.tokenizer(code), toks, ret = "";
    toks = tok().comments_before;

    if (toks.length >= 1) {
      var c = toks[0];
      // copyrights that we'll include MUST be before code body and have
      // the form: /** */
      if (c.value.substr(0, 1) === '*' && c.type === 'comment2') {
        ret += "/*" + c.value + "*/";
      }
    }

    return ret;
  };

  function compress() {
    try {
      var final_code;
      if (/\.js$/.test(name)) {
        // extract copyright
        var copyright = extract_copyright(orig_code) || "";
        if (copyright.length) copyright += "\n\n";

        // compress javascript
        var ast = jsp.parse(orig_code); // parse code and get the initial AST
        ast = pro.ast_mangle(ast); // get a new AST with mangled names
        ast = pro.ast_squeeze(ast); // get an AST with compression optimizations
        final_code = copyright + pro.split_lines(pro.gen_code(ast), 32 * 1024); // compressed code here
      } else if (/\.css$/.test(name)) {
        // compress css
        var cach_code = cachify_embedded(orig_code);
        final_code = uglifycss.processString(cach_code);
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

function cachify_embedded (css_src) {
  // RegExp is set up to handle multiple url's per declaration, which is
  // possible for things like background-images.
  return css_src.replace(/url\s*\(['"]([^\)'"]+)\s*['"]\s*\)/g, function (str, url) {
    // This will throw an error if url doesn't exist. This is good as we will
    // catch typos during build.
    logger.info("For " + str + " making " + url + " into " + cachify.cachify(url));
     return "url('" + cachify.cachify(url) + "')";
  });
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
