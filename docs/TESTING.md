<!-- This Source Code Form is subject to the terms of the Mozilla Public
   - License, v. 2.0. If a copy of the MPL was not distributed with this
   - file, You can obtain one at http://mozilla.org/MPL/2.0/. -->

Developer tests should be run before committing code. There are two test suites.

  - `npm test`

  - Load http://localhost:10002/test/index.html into a world wide web browser

Note that for mysql, you will need to grant `browserid` privileges to create tables.
You can then run the mysql suite with, e.g., 

    NODE_ENV=test_mysql MYSQL_USER=browserid MYSQL_PASSWORD=browserid npm test

  
