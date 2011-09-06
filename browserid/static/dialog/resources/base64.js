;(function (window) {

  var
    characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=',
    fromCharCode = String.fromCharCode,
    INVALID_CHARACTER_ERR = (function () {
      // fabricate a suitable error object
      try { document.createElement('$'); }
      catch (error) { return error; }}());

  // encoder
  window.btoa || (
  window.btoa = function (string) {
    var
      a, b, b1, b2, b3, b4, c, i = 0,
      len = string.length, max = Math.max, result = '';

    while (i < len) {
      a = string.charCodeAt(i++) || 0;
      b = string.charCodeAt(i++) || 0;
      c = string.charCodeAt(i++) || 0;

      if (max(a, b, c) > 0xFF) {
        throw INVALID_CHARACTER_ERR;
      }

      b1 = (a >> 2) & 0x3F;
      b2 = ((a & 0x3) << 4) | ((b >> 4) & 0xF);
      b3 = ((b & 0xF) << 2) | ((c >> 6) & 0x3);
      b4 = c & 0x3F;

      if (!b) {
        b3 = b4 = 64;
      } else if (!c) {
        b4 = 64;
      }
      result += characters.charAt(b1) + characters.charAt(b2) + characters.charAt(b3) + characters.charAt(b4);
    }
    return result;
  });

  // decoder
  window.atob || (
  window.atob = function (string) {
    string = string.replace(/=+$/, '');
    var
      a, b, b1, b2, b3, b4, c, i = 0,
      len = string.length, chars = [];

    if (len % 4 === 1) throw INVALID_CHARACTER_ERR;

    while (i < len) {
      b1 = characters.indexOf(string.charAt(i++));
      b2 = characters.indexOf(string.charAt(i++));
      b3 = characters.indexOf(string.charAt(i++));
      b4 = characters.indexOf(string.charAt(i++));

      a = ((b1 & 0x3F) << 2) | ((b2 >> 4) & 0x3);
      b = ((b2 & 0xF) << 4) | ((b3 >> 2) & 0xF);
      c = ((b3 & 0x3) << 6) | (b4 & 0x3F);

      chars.push(fromCharCode(a));
      b && chars.push(fromCharCode(b));
      c && chars.push(fromCharCode(c));
    }
    return chars.join('');
  });

}(this));
