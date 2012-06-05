<!-- This Source Code Form is subject to the terms of the Mozilla Public
   - License, v. 2.0. If a copy of the MPL was not distributed with this
   - file, You can obtain one at http://mozilla.org/MPL/2.0/. -->

Several node.js servers are implemented in this repostiory, each is
implemented on top of the [express](http://expressjs.com) framework
and they share the following directory structure:

* `bin/` - Contains the BrowserID servers (browserid,  dbwriter, keysgner, and verifier) and CLI tools.

 * Each node.js application is the "entry point" for that app and is a typical express app.

* `scripts/` - Contains more CLI tools

 * `run_locally.js` - Script to run all the node.js servers server - typically bound
    against a well known localhost port.

* `lib/` - Server side JavaScript modules

* `var/` - A demand created directory with ephemeral files generated
            during the run (keys, logs, etc).

* `resources/`

 * `views/` - Express views (server side), served before `static/` (if present)

 * `static/` - Files served verbatim without any substitution nor server
            side logic in them

  * `include.js` - The JS file included by all RPs.

  * `dialog/` - The meat of the BID dialog, a client side MVC architecture with a state machine

   * `views/` - Client side EJS templates, not executed by ejs.js server side

   * `resources/` - State machine and other logic powering the dialog

  * `pages/` - Client side business logic for dialog

  * `shared/` - JavaScript which is re-used across dialogs

  * `test/` - QUnit tests

* `tests/` - Tests written using [vows](http://vowsjs.org)

 * Run via `scripts/test`
