steal.plugins(	
	'jquery/controller',			// a widget factory
	'jquery/controller/subscribe',	// subscribe to OpenAjax.hub
	'jquery/view/ejs',				// client side templates
	'jquery/controller/view')		// lookup views with the controller's name
	
	.css('style')	// loads styles

	.resources('jschannel',
             'underscore-min',
             'crypto',
             'crypto-stubs',
             'main')					// 3rd party script's (like jQueryUI), in resources folder

	.models()						// loads files in models folder 

	.controllers('signin',
               'authenticate',
               'addemail',
               'errormessage',
               'waiting')					// loads files in controllers folder

	.views();						// adds views to be added to build