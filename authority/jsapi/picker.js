// this is the picker code!  it runs in the identity provider's domain, and
// fiddles the dom expressed by picker.html

var chan = Channel.build(
  {
    window: window.opener,
    origin: "*",
    scope: "mozid"
  });

chan.bind("getVerifiedEmail", function(trans, s) {
  trans.delayReturn(true);

  // set the requesting site
  document.getElementById("sitename").innerText = trans.origin.replace(/^.*:\/\//, "");

  // iterate over all of the available identities and add a links to them
  // XXX -- actually pull these guys outta localStorage

  var list = document.getElementById('identities');

  var first = true;
  [ "foo@bar.com", "baz@bing.com" ].forEach(function(i) {
    var div = document.createElement("div");
    var button = document.createElement("input");
    button.setAttribute('type', 'radio');
    button.checked = first;
    first = false;
    button.name = "id_selection";
    button.value = i;
    div.appendChild(button);
    var label = document.createElement("div");
    label.innerText = i;
    label.addEventListener("click", function(evt) {
      console.log("clicked label: ");
      this.parentNode.firstChild.checked = true;
    });
    div.appendChild(label);
    list.appendChild(div);
  });

  // now make the body visible...
  document.getElementById("body").style.display = "block";

  document.getElementById('signin').addEventListener("click", function(evt) {
    var is = document.forms["identities"].elements['id_selection'];
    var id = undefined;
    for (var i = 0; i < is.length; i++) {
      if (is[i].checked) {
        id = is[i].value;
        break;
      }
    }
    if (id) {
      trans.complete(id);
      window.self.close();
    } else {
      trans.error("noSelection", "no id selected by user");
      window.self.close();
    }
  });

  document.getElementById('cancel').addEventListener("click", function(evt) {
    trans.error("noSelection", "no id selected by user");
    window.self.close();
  });
});

