/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Unlike most user agent string parsers, we don't want to be as accurate as possible.
 * This is for several reasons:
 *  * protect user privacy (no fingerprinting)
 *  * Surface only 80% case uses in our visualization UI
 *  * KISS

 * Test data via http://www.useragentstring.com/pages/All/
 * Converted with https://gist.github.com/2590522
 *
 */
exports.parse = function (ua_string) {
  var user_agent = {
        os: 'Unknown',
        browser: 'Unknown',
        version: 'Unknown'
      },
      os_matchers = {
        'iPod': 'iPod',
        'iPad': 'iPad',
        'iPhone': 'iPhone',
        'Android': 'Android',
        'BlackBerry': 'BlackBerry',
        'Linux': 'Linux',
        'Macintosh': 'Macintosh',
        // http://lawrencemandel.com/2012/07/27/decision-made-firefox-os-user-agent-string/
        'FirefoxOS': 'Mozilla/5.0 (Mobile; rv:',
        // http://en.wikipedia.org/wiki/Microsoft_Windows#Timeline_of_releases
        // Windows 8
        'Windows NT 6.2': 'Windows NT 6.2',
        // Windows 7
        'Windows NT 6.1': 'Windows NT 6.1',
        // Windows Vista
        'Windows NT 6.0': 'Windows NT 6.0',
        // Windows XP
        'Windows NT 5.1': 'Windows NT 5.1',
        // Windows 2000
        'Windows NT 5.0': 'Windows NT 5.0'
      },
      basic = function (ua_string) {
        // Looks for SomeString/5.1 at the end of a UA and parses 5.1 as an integer returning 5
        // Expected outputs... Firefox 14, Safari 533, Opera 12
        try {
          //console.log(parseInt(ua_string.split(' ').splice(-1)[0].split('/')[1]));
          var v = parseInt(ua_string.split(' ').splice(-1)[0].split('/')[1], 10);
          if (! isNaN(v)) {
            return v;
          }
        } catch (e) {
          console.error(e.toString());
        }
        return 'Unknown';
      },
      keyword = function (kw) {
        //console.log('Keyword is ', kw);
        return function (ua_string) {
          //console.log(ua_string);
          // Looks for MSIE 9.0 in the middle of the ua_string
          var start = ua_string.indexOf(kw) + kw.length;
          //console.log('start', start);
          if (start !== -1) {
            var end = ua_string.indexOf(' ', start + 1);
            //console.log('end is ', end);
            try {
              //console.log('ua_string.substring(start, end)=' + ua_string.substring(start, end));
              var v = parseInt(ua_string.substring(start, end), 10);
              if (! isNaN(v)) {
                return v;
              }
            } catch (e) {
              console.error('ERROR: ' + e.toString());
            }
          }
          return 'Unknown';
        };
      },
      msie = keyword('MSIE '),
      chrome = keyword('Chrome/'),
      browser_matchers = [
        ['Chrome', chrome], ['Opera Mini', basic], ['Opera Mobile', basic], ['Opera', basic],
        ['MSIE', msie], ['Safari', basic], ['Firefox', basic]
      ];
  if (! ua_string) {
    console.error('Empty UA String');
    return;
  }
  // Safari uses basic version reader to get 533 instead of 5. This is probably more useful and matches Android, Mobile Safari, etc.

  // In os_matchers and browser_matchers order matters, many browsers pretend to be other
  // browsers http://webaim.org/blog/user-agent-string-history/
  for (var os in os_matchers) {
    var os_match = os_matchers[os];
    if (ua_string.indexOf(os_match) !== -1) {
      user_agent.os = os;
      break;
    }
  }

  var browser_known = false;
  browser_matchers.forEach(function (el) {
    if (browser_known) return;
    if (ua_string.indexOf(el[0]) !== -1) {
      browser_known = true;
      user_agent.browser = el[0];
      user_agent.version = el[1](ua_string);
    }
    return;
  });

  return user_agent;
};
