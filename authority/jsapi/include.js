// this is the file that the RP includes to shim in the
// navigator.id.getVerifiedEmail() function

if (!navigator.id) { navigator.id = {} }

if (!navigator.id.getVerifiedEmail) {
    navigator.id.getVerifiedEmail = function() {
        var w = window.open("../authority/jsapi/picker.html", "_mozid_picker",
                            "menubar=no,location=no,resizable=no,scrollbars=no,status=no,dialog=yes,width=420,height=230");
        
    };
}
