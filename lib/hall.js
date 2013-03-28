(function() {
	
var _ = require('underscore'),
	Module = require('./module').Module,
	url = require('url'),
	events = require('events'),
	request = require('request'),
	io = require('socket.io-client'),
	
	baseURL = function() {
		return url.parse(process.env.NODE_HALL_URL || 'https://hall.com');
	},

	apiBaseURL = function() {
		return url.parse(process.env.NODE_HALL_API_URL || 'https://hall.com/api/1');
	},

	streamBaseURL = function() {
		return url.parse((process.env.NODE_HALL_STREAMING_URL || 'https://node.hall.com:443')+'/room');
	},

	Session = Module.extend({

		defaults : {
			email : '',
			password : ''
		},

		url : function() {
			return baseURL().href + '/users/' + this.get('id');
		},

		initialize : function(options) {
			var me = this;
			me.set(options);
			Module.prototype.initialize.apply(me,this);
			return me.initSession();
		},

		initSession : function() {

			var me = this,
			 	options = {
					uri: baseURL().href + 's',
					method: 'GET',
					headers: {
						'Accept': 'application/json'
					}
				};
				
			request(options, function(error, res, body) {
				var data = JSON.parse(body);
				if (error || res.statusCode >= 300) {
					me.trigger('error', res);
				} else if (!data || !data.csrf_token) {
					me.trigger('error', 'Could not establish session with Hall');
				} else {
					if (data.active_session != undefined && data.active_session) {
						me.set(data.active_session);
					}
					if (data.csrf_token) {
						me.set({
							authenticity_token : data.csrf_token
						});
					}
					me.signIn();
				}
			});

			return me;

		},
	
		initSocket : function() {
			var me = this;
			me.socket = io.connect(streamBaseURL().href, {
				'transports' : ['websocket'],
				'reconnect': true,
				'reconnection delay': 500,
				'reopen delay': 500,
				'max reconnect attempts' : 5
			});
			var $emit = me.socket.$emit;
			me.socket.$emit = function() {
				me.onIOEvent.apply(me,arguments);
				$emit.apply(me.socket, arguments);
			};
			return me.bindSocket().trigger('socketReady');
		},
	
		bindSocket : function() {
			var me = this;
			me.socket.on('connect', _.bind(me.onIOConnect, me));
			me.socket.on('join_success', function () { console.log("socket join_success"); });
			me.socket.on('reconnecting', function () { console.log("socket reconnecting"); });
			me.socket.on('connect_failed', function () { console.log("socket connect_failed"); });
			me.socket.on('disconnect', function () { console.log("socket disconnect"); });
			me.socket.on('error', function (e) { console.log(e); });
			return me;
		},
		
		onIOConnect : function(data) {
			console.log('======================================================');
			console.log('Hall is hiring engineers. Say hello! jobs@hall-inc.com');
			console.log('======================================================');
			console.log('connected!!!');
			var me = this;
			try {
				me.joinRoom();
			} catch(e) {
				console.log(e);
				console.log('Hall IOConnect error');
			}
		},

		onIOEvent : function(id,data) {
			try {
				// console.log(id);
				// console.log(data);
			} catch (e) {
				CL.log('onIOEvent Listener Error');
			}
		},
		
		sendMessage : function(room_uuid, string) {

			var me = this,
			 	options = {
					uri: apiBaseURL().href + '/halls/'+room_uuid+'/hall_feeds',
					method: 'POST',
					json: {
						comment : {
							content : string
						},
						authenticity_token : me.toJSON().authenticity_token
					},
					headers: {
						'Accept': 'application/json'
					}
				};
				
			request(options, function(error, res, body) {
				var data = body;
				if (error || res.statusCode >= 300) {
					me.trigger('error', res);
				} else if (!data || !data.token) {
					me.trigger('error', 'Unable to connect with Hall.');
				}
			});
			
		},
	
		getJoinRoomObj : function() {
		
			var me = this,
				obj = {
					name : (me.get('full_name') || 'Hubot'),
					id : me.get('id'),
					hall_member_id : null,
					hall_uuid : null,
					photo_url : me.get('photo_url'),
					mobile : false,
					native : false
				};

			return obj;
			
		},
	
		joinRoom : function() {
			var me = this;
			me.socket.emit('join room', {
				uuid: 'globalHall',
				member : me.getJoinRoomObj(),
				member_uuid : me.get('uuid')
			});
			return me;
		},

		signIn : function() {

			var me = this,
			 	options = {
					uri: baseURL().href + 'users/sign_in',
					method: 'POST',
					json: {
						user : _.pick(me.toJSON(), 'email', 'password'),
						authenticity_token : me.toJSON().authenticity_token
					},
					headers: {
						'Accept': 'application/json'
					}
				};
				
			request(options, function(error, res, body) {
				
				console.log('Hall.com contacted....response:');
				console.log(body);
				
				var data = body;
				
				if (error || res.statusCode >= 300) {
					me.trigger('error', res);
				} else if (!data || !data.token) {
					me.trigger('error', 'Unable to authenticate with Hall.  Please check your email/password.');
				} else {
					me.set(data).initSocket();
				}
				
			});

			return me;

		}

	});

exports.Session = Session;

}).call(this);
