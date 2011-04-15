This is an exploration of the distributed identity system
[described here](https://wiki.mozilla.org/Labs/Identity/VerifiedEmailProtocol).

## Required software:

All of the servers present in this repository are based on node.js, and a
minimal but non-zero number of 3rd party node modules are required to make
it go.  [npm](http://npmjs.org/) is a good tool to use to acquire the requisite modules.

* node.js (>= 0.4.5): http://nodejs.org/
* The connect framework (>= 1.3.0): http://senchalabs.github.com/connect/
* xml2js (>= 0.1.5)
* sqlite (>= 1.0.3)
* mustache (>= 0.3.1)
* cookie-sessions (patched version included in-tree, nothing to be done)

## Getting started:

1. install required software
2. run the top level *run.js* script: `node ./run.js`
3. visit the demo application ('rp') in your web browser (url output on the console at runtime)␁
