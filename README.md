This is an exploration of the distributed identity system
[described here](https://wiki.mozilla.org/Labs/Identity/VerifiedEmailProtocol).

## Required software:

All of the servers here are based on node.js, and some number of 3rd party node modules are required to make them go.  ([npm](http://npmjs.org/) is a good way to get these libraries)

* node.js (>= 0.4.5): http://nodejs.org/
* Several node.js 3rd party libraries - check `package.json` for details


## Getting started:

1. install node
2. run `npm install` to installed 3rd party libraries into `node_modules`
3. run the top level *run.js* script: `node ./run.js`
4. visit the demo application ('rp') in your web browser (url output on the console at runtime)␁

## Testing

We should start using this:

  https://github.com/LearnBoost/tobi

for integration testing

and straight Vows for unit testing
