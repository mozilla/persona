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

  var list = document.getElementById('availableIdentities');
  [ "foo@bar.com", "baz@bing.com" ].forEach(function(i) {
    var li = document.createElement("li");
    var link = document.createElement("a");
    link.innerText = i;
    link.href = "#";
    li.appendChild(link);
    link.addEventListener("click", function(evt) {
      trans.complete(this.innerText);
    });
    list.appendChild(li);
  });

  // now let's make the body visible
  document.getElementById("body").style.display = "block";
});

