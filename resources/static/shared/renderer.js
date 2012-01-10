/*jshint browsers:true, forin: true, laxbreak: true */
/*global BrowserID: true, _: true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
BrowserID.Renderer = (function() {
  "use strict";

  var bid = BrowserID,
      dom = bid.DOM;

  function getTemplateHTML(body, vars) {
    var config,
        templateText = bid.Templates[body];

    if(templateText) {
      config = {
        text: templateText
      };
    }
    else {
      // TODO - be able to set the directory
      config = {
        url: "/dialog/views/" + body + ".ejs"
      };
    }

    var html = new EJS(config).render(vars);
    return html;
  }

  function render(target, body, vars) {
    var html = getTemplateHTML(body, vars);
    return dom.setInner(target, html);
  }

  function append(target, body, vars) {
    var html = getTemplateHTML(body, vars);
    return dom.appendTo(html, target);
  }

  return {
    render: render,
    append: append
  }
}());

