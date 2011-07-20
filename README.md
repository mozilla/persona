This is an exploration of the distributed identity system
[described here](https://wiki.mozilla.org/Labs/Identity/VerifiedEmailProtocol).

## Required software:

All of the servers here are based on node.js, and some number of 3rd party node modules are required to make them go.  ([npm](http://npmjs.org/) is a good way to get these libraries)

* node.js (>= 0.4.5): http://nodejs.org/
* express (>= 2.3.11): http://senchalabs.github.com/express/
* xml2js (>= 0.1.5)
* sqlite (>= 1.0.3)
* mustache (>= 0.3.1)
* cookie-sessions (>= 0.0.2)
* nodemailer (>= 0.1.18)
* vows (>= 0.5.8)
* bcrypt (>= 0.2.3)
* ejs (>= 0.4.3)
* temp (>= 0.2.0)
* express-csrf (>= 0.3.2)
* uglify (>= 1.0.6)

## Getting started:

1. install required software
2. run the top level *run.js* script: `node ./run.js`
3. visit the demo application ('rp') in your web browser (url output on the console at runtime)␁

## Testing

We should start using this:

  https://github.com/LearnBoost/tobi

for integration testing

and straight Vows for unit testing
