/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function Gettext(params) {
    return {
      gettext: function (msgid) {
        if (json_locale_data && json_locale_data["client"]) {
        var dict = json_locale_data["client"];
          if (dict[msgid]) {
            return dict[msgid];
          }
      }
      return msgid;
      },
      strargs: function (fmt, args) {
        return fmt;
      }
    };
};