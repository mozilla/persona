steal = function () {
    for (var i = 0; i < arguments.length; i++) {
        if (typeof arguments[i] == "function") {
            arguments[i](jQuery);
        }
    }

    return steal;
};

steal.plugins = steal.plugin = steal.then = steal.resources = steal;

steal.dev = function () { };