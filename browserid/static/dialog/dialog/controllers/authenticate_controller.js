//
// a JMVC controller for signing in
//

$.Controller("Authenticate", {}, {
    init: function(el) {
      this.element.html("<h2>Authenticate!</h2>");
    },

    "click" : function(div, ev) {
      alert('div is ' + div);
    }
  });