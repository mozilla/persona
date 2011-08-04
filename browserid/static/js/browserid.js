$(function() {
  if ($('#emailList')) {
    display_saved_ids();
  }
});

function display_saved_ids()
{
  var emails = {};
  if (window.localStorage.emails) {
    emails = JSON.parse(window.localStorage.emails);
  }

  $('#cancellink').click(function() {
    if (confirm('Are you sure you want to cancel your account?')) {
      $.post("/wsapi/account_cancel", {csrf: window.csrf}, function(result) {
        window.localStorage.emails = null;
        document.location="/";
      });
    }
  });

  $("#emailList").empty();
  _(emails).each(function(data, e) {
      var block = $("<div>").addClass("emailblock");
      var label = $("<div>").addClass("email").text(e);
      var meta = $("<div>").addClass("meta");

      /* 
        var priv = $("<div class='keyblock'>").text(data.priv);
        priv.hide();
       */

      var pub = $("<div class='keyblock'>").text(data.pub);
      pub.hide();
      var linkblock = $("<div>");
      var puba = $("<a>").text("[show public key]");
      // var priva = $("<a>").text("[show private key]");
      puba.click(function() {pub.show()});
      // priva.click(function() {priv.show()});
      linkblock.append(puba);
      // linkblock.append(" / ");
      // linkblock.append(priva);
      
      var deauth = $("<button>").text("Forget this Email");
      meta.append(deauth);
      deauth.click(function() {
        var t = JSON.parse(window.localStorage.emails);
        // remove email from server
        $.post("/wsapi/remove_email", {"email" : e, "csrf": window.csrf}, function(response) {
                    // we delete from store only once we got response
                    delete t[e];
                    window.localStorage.emails = JSON.stringify(t);
                    display_saved_ids();
                    });
      });
      
      var d = new Date(data.created);
      var datestamp = $("<div class='date'>").text("Signed in at " + d.getHours() + ":" + d.getMinutes() + ":" + d.getSeconds() + ", " + d.getMonth() + "/" + d.getDay() + "/" + d.getUTCFullYear());

      meta.append(datestamp);
      meta.append(linkblock);
                  
      block.append(label);
      block.append(meta);
      // block.append(priv);
      block.append(pub);
      
      $("#emailList").append(block);
  });
}
