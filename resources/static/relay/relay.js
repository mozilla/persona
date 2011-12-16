function doPost(msg, origin) {
  window.parent.postMessage(msg, origin);
}
