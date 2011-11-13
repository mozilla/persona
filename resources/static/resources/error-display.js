BrowserID.ErrorDisplay = (function() {
  "use strict";

  function render(target, template, data) {
      template = $(template).html();
      _.templateSettings = {
          interpolate : /\{\{(.+?)\}\}/g,
          evaluate : /\{\%(.+?)\%\}/g
      };
      var display = $(_.template(template, data)).appendTo(target);

      /**
       * What a big steaming pile, use CSS animations for this!
       */
      display.find("#openMoreInfo").click(function(event) {
        event.preventDefault();

        display.find("#moreInfo").slideDown();
        display.find("#openMoreInfo").css({visibility: "hidden"});
      });
    
      return display;
  }

  return {
    render: render
  };

}());

