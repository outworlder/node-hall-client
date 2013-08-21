/**
 *
 * Example to open a file and send it a hall.com room (need room_id from URL)
 *
 */
(function() {

	var fs = require("fs");
	var hall = require("./index.js");

	var hall_config = {
		email: process.env.HALL_EMAIL,
		password: process.env.HALL_PASSWORD,
		ua: {
			meta: "Hall-Client-Adapter-Test"
		}
	};

	var app = process.argv[1];
	if (process.argv.length !== 3) {
		console.log("Usage: node %s file_path".replace(/%s/, app));
		return;
	}

	var file = process.argv[2];
	fs.readFile(file, {encoding: "utf8"}, function (err, data) {
		if (err) {
			console.log("Usage: node %s file_path".replace(/%s/, app));
			return;
		}

		var contents = (""+data).replace(/^#-.*$\n/mg, "");
		if (contents) {
			var bot = new hall(hall_config);

			bot.on("sent", function() { process.exit(0); });
			bot.io.on("sent", function() { process.exit(0); });

			bot.on("error", function() { process.exit(1); });
			bot.io.on("error", function() { process.exit(1); });

			bot.io.on("connected", function() {
				bot.sendMessage("room_id", "group", contents);
			});
		}
	});

}).call(this);
