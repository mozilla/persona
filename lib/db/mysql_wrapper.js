/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* This abstraction wraps the mysql driver and provides application level
 * queueing, as well as query timing and reconnect upon an apparently "stalled"
 * driver
 */

const
mysql = require('mysql'),
statsd = require('../statsd'),
logger = require('../logging.js').logger,
config = require('../configuration.js');

exports.createClient = function(options) {
  // the application level query queue
  var queryQueue = [];
  // The slowQueryTimer is !null when a query is running, and holds
  // the result from setTimeout.  This variable is both a means to
  // check if a query is running (only one runs at a time), and as
  // the timeout handle.
  var slowQueryTimer = null;
  // how many consecutive failures have we seen when running queries?
  var consecutiveFailures = 0;
  // a testing feature.  By calling `client.stall` you can
  // cause responses to be dropped which will trigger slow query detection
  var stalled = false;

  var client = {
    stall: function(stalledState) {
      stalled = stalledState;
    },
    realClient: null,
    _resetConnection: function() {
      if (this.realClient) this.realClient.destroy();
      this.realClient = mysql.createClient(options);
      this.realClient.on('error', function(e) {
        logger.warn("database connection down: " + e.toString());
      });
    },
    ping: function(client_cb) {
      // ping queries are added to the front of the pending work queue.  they are
      // a priority, as they are used by load balancers that want to know the health
      // of the system.
      queryQueue.unshift({
        ping: true,
        cb: client_cb
      });
      this._runNextQuery();
    },
    _runNextQuery: function() {
      var self = this;

      if (slowQueryTimer !== null || !queryQueue.length) return;

      var work = queryQueue.shift();

      function invokeCallback(cb, err, rez) {
        if (cb) {
          process.nextTick(function() {
            try {
              cb(err, rez);
            } catch(e) {
              logger.error('database query callback failed: ' + e.toString());
            }
          });
        }
      }

      slowQueryTimer = setTimeout(function() {
        if (++consecutiveFailures > config.get('database.max_reconnect_attempts')) {
          // if we can't run the query multiple times in a row, we'll fail all outstanding
          // queries, and reinitialize the connection, so that the process stays up and
          // retries mysql connection the next time a request which requires db interaction
          // comes in.
          queryQueue.unshift(work);
          logger.warn("cannot reconnect to mysql! " + queryQueue.length + " outstanding queries #fail.");
          queryQueue.forEach(function(work) {
            invokeCallback(work.cb, "database connection unavailable");
          });
          queryQueue = [];
          self._resetConnection();
          slowQueryTimer = null;
        } else {
          logger.warn("Query taking more than " + config.get('database.max_query_time_ms') + "ms!  reconnecting to mysql");
          // we'll fail the long running query, because we cannot
          // meaningfully know whether or not it completed in the case where
          // the driver is unresponsive.
          invokeCallback(work.cb, "database connection unavailable");
          self._resetConnection();
          slowQueryTimer = null;
          self._runNextQuery();
        }
      }, config.get('database.max_query_time_ms'));

      if (work.ping) {
        this.realClient.ping(function(err) {
          if (stalled) {
            return invokeCallback(work.cb, "database is intentionally stalled");
          }

          clearTimeout(slowQueryTimer);
          slowQueryTimer = null;
          consecutiveFailures = 0;

          invokeCallback(work.cb, err);

          self._runNextQuery();
        });
      } else {
        this.realClient.query(work.query, work.args, function(err, r) {
          // if we want to simulate a "stalled" mysql connection, we simply
          // ignore the results from a query.
          if (stalled) return;

          clearTimeout(slowQueryTimer);
          slowQueryTimer = null;
          consecutiveFailures = 0;

          // report query time for all queries via statsd
          var reqTime = new Date - work.startTime;
          statsd.timing('query_time', reqTime);

          // report failed queries via statsd
          if (err) statsd.increment('failed_query'); 

          invokeCallback(work.cb, err, r);
          self._runNextQuery();
        });
      }
    },
    query: function() {
      var client_cb;
      var args = Array.prototype.slice.call(arguments);
      var query = args.shift();
      if (args.length && typeof args[args.length - 1] === 'function') {
        client_cb = args.pop();
      }
      args = args.length ? args[0] : [];
      queryQueue.push({
        query: query,
        args: args,
        cb: client_cb,
        // record the time .query was called by the application for
        // true end to end query timing in statsd
        startTime: new Date()
      });
      this._runNextQuery();
    },
    end: function(cb) {
      this.realClient.end(cb);
    },
    useDatabase: function(db, cb) {
      this.realClient.useDatabase(db, cb);
    }
  };
  client._resetConnection();
  client.database = client.realClient.database;
  return client;
};
