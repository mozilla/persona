Several node.js servers are implemented in this repostiory, each is
implemented on top of the [express](http://expressjs.com) framework
and should obey roughly the following directory structure:

  * `var/` - a demand created directory with ephemeral files generated
             during the run (keys, logs, etc).
  * `static/` - files served verbatim without any substitution nor server
             side logic in them
  * `lib/` - javascript modules.
  * `views/` - express views, served before `static/` (if present)
  * `tests/` - tests written using [vows](http://vowsjs.org)
  * `tests/run.js` - a "run all" script to run all tests
  * `app.js` application "entry point", exposes a single function `exports.setup`
    that takes a handle to an express server as an argument and sets up routes
    or associates middleware to it.
  * `run.js` - script to run a standalone (production) node.js server - typically bound
     against a well known localhost port.
