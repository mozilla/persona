/*globals BrowserID:true, $:true*/
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

(function() {
  "use strict";

  BrowserID.index = function () {
    $('.granted').hover(function() {
      $('#card').toggleClass('insert');
      $('#status').delay(400).toggleClass('green');
    });

    $('.create').hover(function() {
      $('#hint').addClass('signUp').removeClass('info');
    });

    $('.info').hover(function() {
      $('#hint').removeClass('signUp').addClass('info');
    });
  };
}());
