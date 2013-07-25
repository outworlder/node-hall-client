(function() {

var Module = require('./module'),
  HallIO = require('./io'),
  HallSession = require('./session'),
  HallUserAgent = require('./user_agent'),

  debug = require('debug')('hall:client'),

	Hall = Module.extend({

		io : null,
		ua : require('./user_agent'),

		initialize : function(options) {
			debug('initializing the hall client');
			var me = this;
			me.set(options);
			if (options && options.ua && options.ua.meta) {
				HallUserAgent.set({ meta : options.ua.meta });
			}
			me.session = new HallSession(options);
			me.io = new HallIO({
				session : me.session
			});
			Module.prototype.initialize.apply(me,this);
			return me;
		},

		sendMessage : function(room_id, room_type, string) {
			var me = this;
			me.io.sendMessage.apply(me,arguments);
			return me;
		}

	});

module.exports = Hall;

}).call(this);
