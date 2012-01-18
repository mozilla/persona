var wc = WinChan.onOpen(function(origin, args, cb) {
  if (window.location.hash === '#complete') cb();
  else {
    wc.detach();
    window.location = args;
  }
});
