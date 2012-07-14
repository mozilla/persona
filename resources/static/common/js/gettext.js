/*globals json_locale_data: true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

(function() {
  "use strict";

  var bid = BrowserID,
      dom = bid.DOM;

  function Gettext() {
      return {
        gettext: function (msgid) {
          if (window.Gobbledygook &&
              dom.getAttr('html', 'lang') === 'db-LB') {
            return window.Gobbledygook(msgid);
          }
              
          if (window.json_locale_data && json_locale_data["client"]) {
            var dict = json_locale_data["client"];
            if (dict[msgid] && dict[msgid].length >= 2 &&
                dict[msgid][1].trim() != "") {
              return dict[msgid][1];
            }
          }
          return msgid;
        },
        // See lib/i18n.js format docs
        format: function (fmt, obj, named) {
          if (!fmt) return "";
          if (!fmt.replace) {
            return fmt;
          }
          if (_.isArray(obj) || named === false) {
            return fmt.replace(/%s/g, function(match){return String(obj.shift())});
          } else if (_.isObject(obj) || named === true) {
            return fmt.replace(/%\(\s*([^)]+)\s*\)/g, function(m, v){
              return String(obj[v]);
            });
          }
        }
      };
  };

  var gt = new Gettext();
  window.gettext = gt.gettext.bind(gt);
  window.format = gt.format.bind(gt);
}());
