(function() {

var _ = require('underscore'),
  Module = require('./module'),
  url = require('url'),
  request = require('request'),
  crypto = require('crypto'),
  WebSocketClient = require('websocket').client,
  HallUserAgent = require('./user_agent'),

  debug = require('debug')('hall:io'),

  baseURL = function() {
    return url.parse(process.env.NODE_HALL_URL || 'https://hall.com');
  },

  apiBaseURL = function() {
    return url.parse(process.env.NODE_HALL_API_URL || 'https://hall.com/api/1');
  },

  streamBaseURL = function(session) {
    return url.parse((process.env.NODE_HALL_STREAMING_URL || 'https://stream.hall.com')+'/socket.io/1/?user_session_id='+session.get('user_session_id')+'&id='+session.get('uuid')+'&session='+crypto.createHash('md5').update("" + session.get('uuid') + session.get('authenticity_token')).digest("hex"));
  },

  streamWSURL = function(io, session) {
    return url.parse((process.env.NODE_HALL_STREAMING_WS_URL || 'wss://stream.hall.com')+'/socket.io/1/websocket/'+io.get('socket_id')+'?user_session_id='+session.get('user_session_id')+'&id='+session.get('uuid')+'&session='+crypto.createHash('md5').update("" + session.get('uuid') + session.get('authenticity_token')).digest("hex"));
  },

  IO = Module.extend({

    session : null,

    client : null,
    connection : null,

    connect_timeout : 1000,
    connectRetryTimer : null,

    initialize : function(options) {
      var me = this;
      me.session = options.session;
      Module.prototype.initialize.apply(me,this);
      if (!me.session) {
        me.trigger('error', 'Trying to initialize the Hall streaming API without session data....exiting.', true);
        return;
      }
      return me;
    },

    initSocket : function() {
      var me = this,
          headers = _.extend({}, HallUserAgent.getHeader(), {
            'Accept': 'application/json',
            cookie : me.session.get('cookie')
          });
      if (me.client) {
        me.client.removeAllListeners();
        me.client = null;
      }
      request({
        uri : streamBaseURL(me.session).href,
        method : 'GET',
        headers : headers
      }, function(error, resp, body) {
        if (error) {
          me.trigger('error', 'Could not establish connection with Hall streaming API ('+streamBaseURL(me.session).href+'): ');
          me.trigger('error', error, true);
          return;
        }
        if (body) {

          if (resp.headers && resp.headers['set-cookie']) {

            var old_cookie = me.session.get('cookie'),
                new_cookie = resp.headers['set-cookie'][0].split(';')[0];

            new_cookie = new_cookie + '; ' + old_cookie;

            me.session.set({
              cookie : new_cookie
            });

          }

          me.set({ socket_id : body.split(':')[0] });
          me.connect();
        }
      });
      return me;
    },

    binder : function() {
      var me = this;
      me.session.on('signIn', me.onSignIn, me);
      Module.prototype.binder.apply(me,arguments);
      return me;
    },

    onSignIn : function() {
      this.initSocket();
    },

    bindConnection : function() {
      var me = this;
      me.connection.on('message', _.bind(me.onMessage, me));
      me.connection.on('error', _.bind(me.onError, me));
      me.connection.on('close', _.bind(me.onClose, me));
      return me;
    },

    onError : function(error, exit) {
      var me = this;
      console.log(error);
      if (exit) {
        process.exit();
      }
    },

    onClientConnect : function(connection) {
      var me = this;
      console.log('websocket is connected to '+streamWSURL(me, me.session).href+'....');
      me.connection = connection;
      me.bindConnection().sendMessageToSocket(1);
    },

    onClientConnectFailed : function(error) {
      var me = this;
      me.trigger('error', 'Could not establish connection with Hall streaming API:');
      me.trigger('error', error.toString());
      me.connect();
    },

    onConnect : function(data) {
      console.log('======================================================');
      console.log('Hall is hiring engineers. Say hello! jobs@hall-inc.com');
      console.log('======================================================');
      console.log('connected!!!');
      var me = this;
      try {
        me.clearConnectionTimer();
        me.joinRoom();
        me.trigger('connected');
      } catch(e) {
        console.log('Hall IOConnect error');
      }
      return me;
    },

    onMessage : function(message) {

      debug('incoming message');
      debug(message);

      var me = this,
          data = message.utf8Data,
          level = data.split('::')[0];

      try {

        if (message.type == 'utf8') {

          if (level == '1' && data.indexOf('/room') > -1) {
            me.onConnect().startHeartbeat();
          } else if (level == '5') {
            var data = JSON.parse(data.split('::/room:')[1]);
            me.trigger(data.name, data.args[0]);
          } else if (level == '7') {
            me.initSocket();
          }

        }

      } catch (e) {
        console.log(e)
        console.log('onIOEvent Listener Error');
      }

    },

    onError : function(error) {
      var me = this;
      me.trigger("error", "Connection Error: " + error.toString());
      me.connect();
    },

    onClose : function() {
      var me = this;
      me.trigger("error", 'Connection Closed....retrying');
      me.connect();
    },

    startHeartbeat : function() {
      var me = this;
      setInterval(function() {
        me.sendMessageToSocket(2);
      }, 60000);
      return me;
    },

    sendMessageToSocket : function(level,name,data) {
      var me = this,
          msg_obj = {
            name : name,
            args : [data]
          },
          msg = (name && data) ? level+'::/room:'+JSON.stringify(msg_obj) : level+'::/room' ;
      me.connection.send(msg);
      return me;
    },

    sendMessage : function(room_id, room_type, string, room_correspondent) {

      var me = this,
        options = {
          uri: apiBaseURL().href + '/rooms/'+room_type+'s/'+room_id+'/room_items',
          method: 'POST',
          json: {
            type : 'Comment',
            message : {
              plain : string
            }
          },
          headers: _.extend({}, HallUserAgent.getHeader(), {
            'Accept': 'application/json',
            'X-CSRF-Token' : me.session.get('authenticity_token'),
            cookie : me.session.get('cookie')
          })
        };

      if (room_correspondent) {
        options.json.correspondent_id = room_correspondent;
      }

      request(options, function(error, resp, body) {
        if (error || resp.statusCode >= 300) {
          me.trigger('error', "Could not send message to Hall. Reason:");
          me.trigger('error', resp);
        }
        else {
          me.trigger('message_sent');
        }
      });

      return me;

    },

    getJoinRoomObj : function() {

      var me = this,
        obj = {
          name : (me.session.get('display_name') || 'Hubot'),
          id : me.session.get('_id'),
          hall_member_id : null,
          hall_uuid : null,
          photo_url : me.session.get('photo_url'),
          mobile : false,
          'native' : false,
          admin : false
        };

      return obj;

    },

    joinRoom : function() {
      var me = this;
      me.sendMessageToSocket(5,'join room', {
        uuid: 'globalHall',
        member : me.getJoinRoomObj(),
        member_uuid : me.session.get('uuid')
      });
      return me;
    },

    connect : function() {

      var me = this;

      if (!me.connectRetryTimer) {
        me.connect_timeout = (me.connect_timeout * 1.25);
        me.connectRetryTimer = _.delay(_.bind(function() {
          me._connect(true);
        }, me), me.connect_timeout);
        me._connect();
      }

      return me;

    },

    _connect : function(clearTimeout) {

        var me = this,
            ws = null;

        debug('trying to connect...timeout currently is set to: ' + me.connect_timeout);

        if (clearTimeout) {
          me.connectRetryTimer = null;
        }

        if (me.client) {
          if (me.connection) {
            me.connection.removeAllListeners();
          }
          me.client.removeAllListeners();
          me.client = null;
        }

        me.client = new WebSocketClient();
        me.client.on('connect', _.bind(me.onClientConnect, me));
        me.client.on('connectFailed', _.bind(me.onClientConnectFailed, me));
        me.client.connect(streamWSURL(me, me.session).href, null, baseURL().href, { headers : _.extend({}, HallUserAgent.getHeader(), { cookie : me.session.get('cookie') })});

        return me;

    },

    clearConnectionTimer : function() {
      debug("clearing connection timer")
      var me = this;
      if (me.connectRetryTimer) {
        clearTimeout(me.connectRetryTimer);
        me.connectRetryTimer = null;
      }
      me.connect_timeout = 1000;
    }

  });

module.exports = IO;

}).call(this);
