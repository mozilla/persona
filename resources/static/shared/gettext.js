/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function Gettext(params) {
    return {
      gettext: function (msgid) {
        if (json_locale_data && json_locale_data["client"]) {
        var dict = json_locale_data["client"];
          if (dict[msgid] && dict[msgid].length >= 2) {
            return dict[msgid][1];
          }
      }
      return msgid;
      },
      // See lib/i18n.js format docs
      format: function (fmt, obj, named) {
        if (! fmt.replace) {
          console.log("format called with", fmt);
          return fmt;
        }
        if (named) {
          return fmt.replace(/%\(\w+\)s/g, function(match){return String(obj[match.slice(2,-2)])});
        } else {
          return fmt.replace(/%s/g, function(match){return String(obj.shift())});
        }
      }
    };
};