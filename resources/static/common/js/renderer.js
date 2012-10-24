/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
BrowserID.Renderer = (function() {
  "use strict";

  var bid = BrowserID,
      dom = bid.DOM;

  function getTemplateHTML(templateName, vars) {
    var templateFn = bid.Templates[templateName];
    if (!templateFn) throw new Error("Template not found: " + templateName);

    var localVars = _.extend({}, vars);
    if(!localVars.partial) {
      localVars.partial = function(name) {
        // partials are not supported by the client side EJS. Create
        // a standin that does what partial rendering would do on the backend.
        return getTemplateHTML(name, vars);
      };
    }

    // arguments are: locals, filters (which cant be used client-side), escapeFn
    return templateFn.call(null, localVars);
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
