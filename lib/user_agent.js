(function() {

var Module = require('./module'),
  pjson = require('../package.json'),

  debug = require('debug')('hall:user_agent'),

	UA = Module.extend({

		initialize : function() {
			var me = this;
			me.set({
				node_agent_version : pjson.version,
				meta : ''
			});
			Module.prototype.initialize.apply(me,this);
			return me;
		},

		getHeader : function() {
			var me = this,
					meta = me.get('meta');
			return {
				'User-Agent' : 'Hall-Node-Client/' + me.get('node_agent_version') + ((meta) ? ' ('+meta+')' : '')
			}
		}

	}),

	UserAgent = new UA();

module.exports = UserAgent;

}).call(this);
