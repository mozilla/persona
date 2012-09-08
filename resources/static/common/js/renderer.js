/*jshint browser: true, forin: true, laxbreak: true */
/*global BrowserID: true, _: true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
BrowserID.Renderer = (function() {
  "use strict";

  var bid = BrowserID,
      dom = bid.DOM;

  function getTemplateHTML(templateName, vars) {
    var templateFn = bid.Templates[templateName];
    vars = vars || {};

    if (!templateFn) throw "Template not found: " + templateName;

    // arguments are: locals, filters (which cant be used client-side), escapeFn
    return templateFn.call(null, vars);
  }

  function render(target, templateName, vars) {
    var html = getTemplateHTML(templateName, vars);
    return dom.setInner(target, html);
  }

  function append(target, templateName, vars) {
    var html = getTemplateHTML(templateName, vars);
    return dom.appendTo(html, target);
  }

  return {
    render: render,
    append: append
  };
}());
