(function() {

var _ = require('underscore'),
	Module = require('./module'),
	url = require('url'),
	request = require('request'),
  HallUserAgent = require('./user_agent'),

  debug = require('debug')('hall:session'),

	baseURL = function() {
		return url.parse(process.env.NODE_HALL_URL || 'https://hall.com');
	},

	getCookie = function(resp) {
		return (resp && resp.headers && resp.headers['set-cookie'] && resp.headers['set-cookie'][0]) ? resp.headers['set-cookie'][0] : '';
	},

	getSessionId = function(resp) {
    var session_id = '',
    		cookie = getCookie(resp),
    		c_array = cookie.split(';');
    _.some(c_array, function(c) {
      is_session_id = (c.indexOf('user_session_id=') === 0);
      if (is_session_id) {
        session_id = c.split('user_session_id=')[1];
      }
      return is_session_id;
    });
    return session_id;
  },

	Session = Module.extend({

		url : function() {
			return baseURL().href + '/users/' + this.get('id');
		},

		initialize : function(options) {

			var me = this;

			me.set(options);

			Module.prototype.initialize.apply(me,this);

			var options = {
						uri: baseURL().href + 's',
						method: 'GET',
						headers: _.extend({}, HallUserAgent.getHeader(), {
							'Accept': 'application/json'
						}),
						timeout : 6000
					};

			request(options, function(error, resp, body) {

				var data = (body) ? JSON.parse(body) : body,
						user_session_id = getSessionId(resp),
						cookie = getCookie(resp);

				if (error || resp.statusCode >= 300) {
					me.trigger('error', 'Could not establish session with Hall ('+options.uri+'):');
					me.trigger('error', error, true);
				} else if (!data || !data.csrf_token) {
					me.trigger('error', 'Could not establish session with Hall ('+options.uri+'):');
					me.trigger('error', 'Session could not be established.', true);
				} else {
					if (data.active_session != undefined && data.active_session) {
						me.set(data.active_session);
					}
					if (data.csrf_token) {
						me.set({
							authenticity_token : data.csrf_token
						});
					}
					if (user_session_id) {
						me.set({
							user_session_id : user_session_id
						});
					}
					me.set({
						cookie : cookie
					});
					me.signIn();
				}

			});
		},

		signIn : function() {

			var me = this,
			 	options = {
					uri: baseURL().href + 'users/sign_in',
					method: 'POST',
					json: {
						user : _.pick(me.attributes, 'email', 'password')
					},
					headers: _.extend({}, HallUserAgent.getHeader(), {
						'Accept': 'application/json',
						cookie : me.get('cookie'),
						'X-CSRF-Token' : me.get('authenticity_token')
					})
				};

			request(options, function(error, resp, body) {

				var data = body,
						user_session_id = getSessionId(resp),
						cookie = getCookie(resp);

				if (user_session_id) {
					me.set({
						user_session_id : user_session_id
					});
				}

				me.set({
					cookie : cookie
				});

				if (error || resp.statusCode >= 300) {
					me.trigger('error', "We could not authenticate with Hall.");
					me.trigger('error', body.error);
					process.exit();
				} else if (!data || !data.token) {
					me.trigger('error', 'Unable to authenticate with Hall.  Please check your email/password.');
					process.exit();
				} else {
					me.set({
						authenticity_token : data.token
					});
					me.set(data).trigger('signIn');
				}

			});

			return me;

		}

	});

module.exports = Session;

}).call(this);
