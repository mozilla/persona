// this is the file that the RP includes to shim in the
// navigator.id.getVerifiedEmail() function

if (!navigator.id) { navigator.id = {} }

if (!navigator.id.getVerifiedEmail) {
    navigator.id.getVerifiedEmail = function() {
        alert("getVerifiedEmail invoked");
    };
}
