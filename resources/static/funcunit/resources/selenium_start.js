steal.then(function(){

FuncUnit.startSelenium = function(){
	importClass(Packages.com.thoughtworks.selenium.DefaultSelenium);
	
	//first lets ping and make sure the server is up
	var addr = java.net.InetAddress.getByName(FuncUnit.serverHost)
	try {
		var s = new java.net.Socket(addr, FuncUnit.serverPort)
	} 
	catch (ex) {
		spawn(function(){
			var jarCommand = 'java -jar '+
				'funcunit/java/selenium-server-standalone-2.0b3.jar'+
				' -userExtensions '+
				'funcunit/java/user-extensions.js';
			if (java.lang.System.getProperty("os.name").indexOf("Windows") != -1) {
				var command = 'start "selenium" ' + jarCommand;
				runCommand("cmd", "/C", command.replace(/\//g, "\\"))
			}
			else {
				var command = jarCommand + " > selenium.log 2> selenium.log &";
				runCommand("sh", "-c", command);
			}
		})
		var timeouts = 0, 
			started = false;
		var pollSeleniumServer = function(){
			try {
				var s = new java.net.Socket(addr, FuncUnit.serverPort)
				started = true;
			} 
			catch (ex) {
				if (timeouts > 3) {
					print("Selenium is not running. Please use steal/js -selenium to start it.")
					quit();
				} else {
					timeouts++;
				}
			}					
		}
		while(!started){
			java.lang.Thread.currentThread().sleep(1000);
			pollSeleniumServer();
		}
	}
}
})
