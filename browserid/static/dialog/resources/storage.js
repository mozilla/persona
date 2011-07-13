
var getEmails = function() {
  try {
    var emails = JSON.parse(window.localStorage.emails);
    if (emails != null)
      return emails;
  } catch(e) {
  }
  
  // if we had a problem parsing or the emails are null
  clearEmails();
  return {};
};

var _storeEmails = function(emails) {
  window.localStorage.emails = JSON.stringify(emails);
};

var addEmail = function(email, obj) {
  var emails = getEmails();
  emails[email] = obj;
  _storeEmails(emails);
};

var removeEmail = function(email) {
  var emails = getEmails();
  delete emails[email];
  _storeEmails(emails);
};

var clearEmails = function() {
  _storeEmails({});
};