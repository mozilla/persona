/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * This is a super tiny replacement for underscore that only contains the
 * functionality that we need. Some of the code comes from underscore itself,
 * some of the code is our own.
 */
(function() {
  "use strict";
  window._ = {
    extend: function(destination) {
      var sources = [].slice.call(arguments, 1);

      _.each(sources, function(source) {
        _.each(source, function(value, key) {
          destination[key] = value;
        });
      });

      return destination;
    },

    each: function(list, iterator, context) {
      if (_.isArray(list)) {
        var len = list.length;
        for (var i = 0; i < len; ++i) {
          iterator.call(context, list[i], i, list);
        }
      }
      else {
        for (var key in list) {
          iterator.call(context, list[key], key, list);
        }
      }
    },

    isArray: function(obj) {
      return Object.prototype.toString.call(obj) === '[object Array]';
    },

    isObject: function(obj) {
      return obj === Object(obj);
    },

    keys: function(obj) {
      var keys = [];
      for (var key in obj) keys.push(key);
      return keys;
    },

    indexOf: function(array, value) {
      var len = array.length;
      for (var i = 0; i < len; ++i) {
        if (array[i] === value) return i;
      }
      return -1;
    },

    keyOf: function(obj, value) {
      for (var key in obj) {
        if (obj[key] === value) {
          return key;
        }
      }
    },

    size: function(obj) {
      return _.isArray(obj) ? obj.length : _.keys(obj).length;
    },

    defer: function(func) {
      var args = [].slice.call(arguments, 0);
      args.splice(1, 0, 0);
      _.delay.apply(null, args);
    },

    delay: function(func, wait) {
      var args = [].slice.call(arguments, 2);
      setTimeout(function() {
        func.apply(null, args);
      }, wait);
    },

    isEmpty: function(obj) {
      if (obj === null) return true;
      if ("length" in obj) return obj.length === 0;
      for (var key in obj) if (obj.hasOwnProperty(key)) return false;
      return true;
    },

    difference: function(array) {
      var others = [].slice.call(arguments, 1);
      var difference = [];

      _.each(array, function(item) {
        var inOther = false;
        _.each(others, function(other) {
          if (_.indexOf(other, item) !== -1) inOther = true;
        });

        if (!inOther) difference.push(item);
      });

      return difference;
    },

    intersection: function(array) {
      var others = [].slice.call(arguments, 1);
      var intersection = [];
      _.each(array, function(item) {
        var inAllOthers = true;
        _.each(others, function(other) {
          if (_.indexOf(other, item) === -1) inAllOthers = false;
        });

        if (inAllOthers) intersection.push(item);
      });

      return intersection;
    },

    escape: function(string) {
      return (''+string).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/\//g,'&#x2F;');
    }
  };


}());
