steal.plugins(	
	'jquery/controller',			// a widget factory
	'jquery/controller/subscribe',	// subscribe to OpenAjax.hub
	'jquery/view/ejs',				// client side templates
	'jquery/controller/view')		// lookup views with the controller's name
	
	.css()	// loads styles

	.resources('jschannel',
             'underscore-min',
             'crypto',
             'crypto-stubs',
             'channel',
             'storage')					// 3rd party script's (like jQueryUI), in resources folder

	.models()						// loads files in models folder 

	.controllers('dialog')					// loads files in controllers folder

	.views('authenticate.ejs');						// adds views to be added to build