// this is the picker code!  it runs in the identity provider's domain, and
// fiddles the dom expressed by picker.html

var chan = Channel.build(
    {
        window: window.opener,
        origin: "*",
        scope: "mozid"

    });
chan.bind("getVerifiedEmail", function(trans, s) {
    alert("you called getVerifiedEmail");
    return "AAA";
});

