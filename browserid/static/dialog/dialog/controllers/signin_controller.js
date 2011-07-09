//
// a JMVC controller for signing in
//

$.Controller("Signin", {}, {
    init: function(el) {
      this.element.html("<h2>Sign In!</h2>");
    },

    "click" : function(div, ev) {
      alert('div is ' + div);
    }
  });