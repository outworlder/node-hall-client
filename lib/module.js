var BB = require('backbone');
	
exports.Module = BB.Model.extend({
	
	fetching : false,
	fetched : false,
	
	initialize : function() {
		var me = this;
		return me.binder();
	},
	binder : function() {
		return this;
	},
	unbinder : function() {
		return this;
	},
	fetch : function(cfg) {
		var me = this;
		cfg = cfg || {};
		if (cfg.force || !me.fetching) {
			me.fetching = true;
			BB.Model.prototype.fetch.apply(me,arguments);
		}
		return me;
	},
	parse : function(data) {
		var me = this;
		me.fetched = true;
		me.fetching = false;
		return BB.Model.prototype.parse.apply(me,arguments);
	},
	destroy : function(cfg) {
		var me = this;
		me.unbinder().destructor();
		BB.Model.prototype.destroy.apply(me,arguments);
		return me;
	},
	destructor : function() {
		return this;
	}
	
});