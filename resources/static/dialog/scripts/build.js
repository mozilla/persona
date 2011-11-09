//steal/js /web/browserid/browserid/static/dialog/dialog/scripts/compress.js

load("steal/rhino/steal.js");
steal.plugins('steal/build','steal/build/scripts','steal/build/styles',function() {
	steal.build('../static/dialog/scripts/build_dialog.html',{
        to: '../static/dialog',
        compressor: 'concatOnly'
    });
	steal.build('../static/dialog/scripts/build_iframe.html',{
        to: '../static/communication_iframe',
        compressor: 'concatOnly'
    });
});
