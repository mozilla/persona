
load("steal/rhino/steal.js");
steal.plugins('steal/build','steal/build/scripts','steal/build/styles',function() {
	steal.build('../static/relay/scripts/build.html',{
        to: '../static/relay',
        compressor: 'concatOnly'
    });
});
