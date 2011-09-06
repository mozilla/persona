/**
 * This file has the methods used to override Selenium's default behavior
 */

Selenium.makeArray = function(arr, win){
	if(!win){
		win = window;
	}
	var narr = win.Array();
	for (var i = 0; i < arr.length; i++) {
		narr.push(arr[i])
	}
	return narr;
}
jQuery.wrapped = function(){
	var args = Selenium.makeArray(arguments),
	    selector = args.shift(),
	    context =  args.shift(),
		method = args.shift(), 
		q, a, res;
		
	
		
	for(var i=0; i < arguments.length; i++){
		if (typeof arguments[i] == 'function' && arguments[i] == Selenium.resume) {
			Selenium.pause();
		}
	}
	if (_win().jQuery && method == 'trigger') {
		q = _win().jQuery(selector, context)
		args = Selenium.makeArray(args, _win())
	} else {
    	q = jQuery(selector, context);
	}
	
	res = q[method].apply(q, args);
    //need to convert to json
    return jQuery.toJSON(res.jquery ? true : res)
};
_win = function(){
	var sel = selenium.browserbot
	return sel.getCurrentWindow()
};
_winVars = function(){
	var sel = selenium.browserbot
	return sel.getCurrentWindow()
};
_doc = function(){
	var sel = selenium.browserbot
	return sel.getCurrentWindow().document
};
Selenium.pause = function(){
	Selenium.paused = true;
};

Selenium.resume = function(){
	Selenium.paused = false;
	currentTest.continueTest();
};
(function(){
var RRTest = RemoteRunner.prototype.continueTest;
RemoteRunner.prototype.continueTest = function(){
	if(Selenium.paused){
		return;
	} 
	RRTest.call(this);
};

// IE9 has problems with open hanging.  It was because this method would return true when win.document couldn't be accessed.
// I overwrite this method and check if it happens while page is unloading, then continue.
IEBrowserBot.prototype._windowClosed = function(win) {
    try {
        var c = win.closed;
        // frame windows claim to be non-closed when their parents are closed
        // but you can't access their document objects in that case
        if (!c) {
            try {
                win.document;
            } catch (de) {
                if (de.message == "Permission denied") {
                    // the window is probably unloading, which means it's probably not closed yet
                    return false;
                }
                else if (/^Access is denied/.test(de.message)) {
                    // rare variation on "Permission denied"?
                    LOG.debug("IEBrowserBot.windowClosed: got " + de.message + " (this.pageUnloading=" + this.pageUnloading + "); assuming window is unloading, probably not closed yet");
                    return false;
                } else {
					if(this.pageUnloading)
					{
						LOG.info("IEBrowserBot.windowClosed2: couldn't read win.document, assume closed: " + de.message + " (this.pageUnloading=" + this.pageUnloading + ")");
						return false;
					}
                    // this is probably one of those frame window situations
                    LOG.debug("IEBrowserBot.windowClosed: couldn't read win.document, assume closed: " + de.message + " (this.pageUnloading=" + this.pageUnloading + ")");
                    return true;
                }
            }
        }
        if (c == null) {
            LOG.debug("IEBrowserBot.windowClosed: win.closed was null, assuming closed");
            return true;
        }
        return c;
    } catch (e) {
        LOG.debug("IEBrowserBot._windowClosed: Got an exception trying to read win.closed; we'll have to take a guess!");

        if (browserVersion.isHTA) {
            if (e.message == "Permission denied") {
                // the window is probably unloading, which means it's not closed yet
                return false;
            } else {
                // there's a good chance that we've lost contact with the window object if it is closed
                return true;
            }
        } else {
            // the window is probably unloading, which means it's not closed yet
            return false;
        }
    }
};
})()