//steal/js /web/browserid/browserid/static/dialog/dialog/scripts/compress.js

load("steal/rhino/steal.js");
steal.plugins('steal/build','steal/build/scripts','steal/build/styles',function(){
	steal.build('/web/browserid/browserid/static/dialog/dialog/scripts/build.html',{to: '/web/browserid/browserid/static/dialog/dialog'});
});
