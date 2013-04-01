#!/usr/bin/env node

/*
 * Generates a static include.js file.
 * Automatically called during postinstall.
 */

var fs   = require('fs'),
    path = require('path');

var dir = path.join(__dirname, '../resources/static/include_js');
var target = path.join(dir, 'include.js');

fs.writeFileSync(target, fs.readFileSync(path.join(dir, '_header.js')));
fs.appendFileSync(target, '\n(function() {\n');
fs.appendFileSync(target, fs.readFileSync(path.join(dir, '_jschannel.js')));
fs.appendFileSync(target, fs.readFileSync(path.join(dir, '_winchan.js')));
fs.appendFileSync(target, fs.readFileSync(path.join(dir, '_include.js')));
fs.appendFileSync(target, '}());\n');
