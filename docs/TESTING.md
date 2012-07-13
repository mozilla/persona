<!-- This Source Code Form is subject to the terms of the Mozilla Public
   - License, v. 2.0. If a copy of the MPL was not distributed with this
   - file, You can obtain one at http://mozilla.org/MPL/2.0/. -->

Developer tests should be run before committing code. There are two test interfaces:

  - `npm test`

  - Load http://localhost:10002/test/index.html into a world wide web browser

## Web Interface

The test URL (`localhost:10002/test`) takes an optional `filter`
argument that can be used to restrict the test suite to one module.
For example, to run only the `shared/xhr` tests, visit:

```
http://localhost:10002/test/?filter=shared/xhr
```

The filter matches substrings, so you can also filter by `shared` to
get `shared/xhr`, `shared/user`, etc.

Test module names are listed on the web page on the left-hand side.

## Shell Interface

### MySQL

Running tests with `npm test` will use a json database by default.  To
test using MySQL, you will need to grant `browserid` privileges to
create tables.  You can then run the mysql suite with, e.g.,

```bash
NODE_ENV=test_mysql MYSQL_USER=browserid MYSQL_PASSWORD=browserid npm test
```

#### Initial MySQL setup

The following will create a database user with enough privileges:

    $ mysql -uroot -p
    > CREATE USER 'browserid'@'localhost' IDENTIFIED BY 'browserid';
    > GRANT ALL ON *.* TO 'browserid'@'localhost';
    > FLUSH PRIVILEGES;

If you need to reset the MySQL root password on a Debian system, you'll need to do something like:

    $ sudo dpkg-reconfigure -plow mysql-server-5.5

### Test Suites

There are two test suites:

- `back`
- `front`

By default the test runner will run them all. You can limit it to one
suite by setting `WHAT_TESTS` in your environment.  For example:

```bash
WHAT_TESTS=front npm test
```

The front-end tests are run via PhantomJS.

### Filtering

As in the web tests, you can tell the runner to run only tests whose
modules match a given name.  Specify this in your environment with
`FRONTEND_TEST_FILTER`.  For example:

```bash
WHAT_TESTS=front FRONTEND_TEST_FILTER=shared/user npm test
```
