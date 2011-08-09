var BrowserIDNetwork = (function() {
  var Network = {
    csrf: function(onSuccess) {
      $.get('/csrf', {}, function(result) {
        BrowserIDNetwork.csrf_token = result;
        if(onSuccess) {
          onSuccess();
        }
      });

    },

    authenticate: function(email, password, onSuccess, onFailure) {
      $.ajax({
        type: "POST",
        url: '/wsapi/authenticate_user',
        data: {
          email: email,
          pass: password,
          csrf: BrowserIDNetwork.csrf_token
        },
        success: function(status, textStatus, jqXHR) {
          if(onSuccess) {
            var authenticated = JSON.parse(status);
            onSuccess(authenticated);
          }
        },
        error: onFailure
      });
    },

    logout: function(onSuccess) {
      $.post("/wsapi/logout", {
        csrf: BrowserIDNetwork.csrf_token
      }, function() {
        BrowserIDNetwork.csrf_token(onSuccess) 
      });
    },

    addEmail: function(email, keypair, origin, onSuccess, onFailure) {
      $.ajax({
        type: 'POST',
        url: '/wsapi/add_email',
        data: {
          email: email,
          pubkey: keypair.pub,
          site: filterOrigin,
          csrf: BrowserIDNetwork.csrf_token
        },
        success: onSuccess,
        error: onFailure
      });

    }
  };

  return Network;

  function filterOrigin(origin) {
    return origin.replace(/^(http|https):\/\//, '');
  }
}());
