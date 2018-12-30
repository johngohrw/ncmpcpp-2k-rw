_.mixin({
	scrobbler : function (x, y, size) {
		this.notify_data = function (name, data) {
			if (name == "2K3.NOTIFY.LOVE")
				this.post(_.tf("%LASTFM_LOVED_DB%", data) == 1 ? "track.unlove" : "track.love", data);
		}
		
		this.playback_new_track = function () {
			this.time_elapsed = 0;
			this.target_time = Math.min(_.ceil(fb.PlaybackLength / 2), 240);
		}
		
		this.playback_time = function () {
			this.time_elapsed++;
			switch (true) {
			case !this.enabled:
				return;
			case this.time_elapsed == 2 && fb.IsMetadbInMediaLibrary(fb.GetNowPlaying()):
				this.post("track.updateNowPlaying", fb.GetNowPlaying());
				break;
			case this.time_elapsed == this.target_time:
				if (!fb.IsMetadbInMediaLibrary(fb.GetNowPlaying())) {
					panel.console("Skipping... Track not in Media Library.");
				} else if (fb.PlaybackLength < this.min_length) {
					panel.console("Not submitting. Track too short.");
					//if not importing, still check to see if a track is loved even if it is too short to scrobble
					if (!this.loved_working && !this.playcount_working)
						this.get("track.getInfo", fb.GetNowPlaying());
				} else {
					this.post("track.scrobble", fb.GetNowPlaying());
				}
				break;
			}
		}
		
		this.post = function (method, metadb) {
			if (!lastfm.ok())
				return;
			var timestamp = _.floor(_.now() / 1000);
			var artist = _.tf("%artist%", metadb);
			var track = _.tf("%title%", metadb);
			var album = _.tf("[%album%]", metadb);
			var duration = _.round(metadb.Length);
			if (!_.tagged(artist) || !_.tagged(track))
				return;
			switch (method) {
			case "track.love":
			case "track.unlove":
				panel.console("Attempting to " + (method == "track.love" ? "love " : "unlove ") + _.q(track) + " by " + _.q(artist));
				panel.console("Contacting Last.fm....");
				var api_sig = md5("api_key" + lastfm.api_key + "artist" + artist + "method" + method + "sk" + lastfm.sk + "track" + track + lastfm.secret);
				var post_data = "sk=" + lastfm.sk + "&artist=" + encodeURIComponent(artist) + "&track=" + encodeURIComponent(track);
				break;
			case "track.scrobble":
				var api_sig = md5("album" + album + "api_key" + lastfm.api_key + "artist" + artist + "duration" + duration + "method" + method + "sk" + lastfm.sk + "timestamp" + timestamp + "track" + track + lastfm.secret);
				var post_data = "format=json&sk=" + lastfm.sk + "&duration=" + duration + "&timestamp=" + timestamp + "&album=" + encodeURIComponent(album) + "&artist=" + encodeURIComponent(artist) + "&track=" + encodeURIComponent(track);
				break;
			case "track.updateNowPlaying":
				var api_sig = md5("api_key" + lastfm.api_key + "artist" + artist + "duration" + duration + "method" + method + "sk" + lastfm.sk + "track" + track + lastfm.secret);
				var post_data = "format=json&sk=" + lastfm.sk + "&duration=" + duration + "&artist=" + encodeURIComponent(artist) + "&track=" + encodeURIComponent(track);
				break;
			default:
				return;
			}
			post_data += "&method=" + method + "&api_key=" + lastfm.api_key + "&api_sig=" + api_sig;
			this.xmlhttp.open("POST", "https://ws.audioscrobbler.com/2.0/", true);
			this.xmlhttp.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
			this.xmlhttp.setRequestHeader("User-Agent", this.ua);
			this.xmlhttp.send(post_data);
			this.xmlhttp.onreadystatechange = _.bind(function () {
				if (this.xmlhttp.readyState == 4) {
					if (this.xmlhttp.status == 200) {
						this.success(method, metadb);
					} else {
						panel.console("HTTP error: " + this.xmlhttp.status);
						this.xmlhttp.responsetext && fb.trace(this.xmlhttp.responsetext);
					}
				}
			}, this);
		}
		
		this.get = function (method, metadb, p) {
			if (lastfm.api_key.length != 32)
				return panel.console("Last.fm API KEY not set.");
			if (lastfm.username.length == 0)
				return panel.console("Last.fm Username not set.");
			var url = lastfm.get_base_url() + "&method=" + method;
			switch (method) {
			case "track.getInfo":
				var artist = _.tf("%artist%", metadb);
				var track = _.tf("%title%", metadb);
				if (!_.tagged(artist) || !_.tagged(track))
					return;
				url += "&username=" + lastfm.username + "&artist=" + encodeURIComponent(artist) + "&track=" + encodeURIComponent(track) + "&autocorrect=0&s=" + _.now();
				break;
			case "user.getLovedTracks":
				if (!this.loved_working)
					return panel.console("Import aborted.");
				this.page = p;
				url += "&limit=200&user=" + lastfm.username + "&page=" + this.page;
				break;
			case "library.getTracks":
				if (!this.playcount_working)
					return panel.console("Import aborted.");
				this.page = p;
				url += "&limit=100&user=" + lastfm.username + "&page=" + this.page
				break;
			}
			this.xmlhttp.open("GET", url, true);
			this.xmlhttp.setRequestHeader("User-Agent", lastfm.ua);
			this.xmlhttp.setRequestHeader("If-Modified-Since", "Thu, 01 Jan 1970 00:00:00 GMT");
			this.xmlhttp.send();
			this.xmlhttp.onreadystatechange = _.bind(function () {
				if (this.xmlhttp.readyState == 4) {
					if (this.xmlhttp.status == 200) {
						this.success(method, metadb);
					} else {
						panel.console("HTTP error: " + this.xmlhttp.status);
						this.xmlhttp.responsetext && fb.trace(this.xmlhttp.responsetext);
						if (p == 1) {
							this.loved_working = false;
							this.playcount_working = false;
						}
					}
				}
			}, this);
		}
		
		this.success = function (method, metadb) {
			switch (method) {
			case "track.love":
			case "track.unlove":
				/*re-instate this if last.fm start returning JSON again
				var data = _.jsonParse(this.xmlhttp.responsetext);
				if (data.error) {
					panel.console(data.message);
				} else if (data.status == "ok") {
					panel.console("Track " + (method == "track.love" ? "loved successfully." : "unloved successfully."));
					fb.RunContextCommandWithMetadb("Customdb Love " + (method == "track.love" ? 1 : 0), metadb, 8);
				}
				*/
				if (this.xmlhttp.responsetext.indexOf("ok") > -1) {
					panel.console("Track " + (method == "track.love" ? "loved successfully." : "unloved successfully."));
					fb.RunContextCommandWithMetadb("Customdb Love " + (method == "track.love" ? 1 : 0), metadb, 8);
				} else {
					panel.console(this.xmlhttp.responsetext);
				}
				break;
			case "track.scrobble":
				var data = _.jsonParse(this.xmlhttp.responsetext);
				if (data.error) {
					panel.console(data.message);
				} else {
					data = _.get(data, 'scrobbles["@attr"]');
					if (data.accepted == 1) {
						panel.console("Track scrobbled successfully.");
						if (!this.loved_working && !this.playcount_working) {
							panel.console("Now fetching updated playcount...");
							this.get("track.getInfo", metadb);
						}
					} else if (data.ignored == 1) {
						panel.console("Track not scrobbled. The submission server refused it possibly because of incomplete tags or incorrect system time.");
					}
				}
				break;
			case "track.updateNowPlaying":
				var data = _.jsonParse(this.xmlhttp.responsetext);
				if (data.error)
					panel.console(data.message);
				else if (_.get(data, "nowplaying.ignoredMessage.code") == 0)
					panel.console("Now playing notification updated ok.");
				break;
			case "track.getInfo":
				var data = _.jsonParse(this.xmlhttp.responsetext);
				if (data.error)
					return panel.console(data.message);
				if (!data.track)
					return panel.console("Unexpected server error.");
				fb.RunContextCommandWithMetadb("Customdb Love " + (data.track.userloved == 1 ? 1 : 0), metadb, 8);
				if (fb.PlaybackLength < this.min_length)
					return;
				var old_playcount = _.parseInt(_.tf("$if2(%LASTFM_PLAYCOUNT_DB%,0)", metadb));
				var new_playcount = data.track.userplaycount > 0 ? _.parseInt(data.track.userplaycount) : 1;
				panel.console("Old value: " + old_playcount);
				panel.console("New value: " + new_playcount);
				switch (true) {
				case new_playcount < old_playcount:
					panel.console("Playcount returned from Last.fm is lower than current value. Not updating.");
					break;
				case new_playcount == old_playcount:
					panel.console("No changes found. Not updating.");
					break;
				case new_playcount == old_playcount + 1:
					fb.RunContextCommandWithMetadb("Customdb Add 1", metadb, 8);
					panel.console("Database updated successfully.");
					break;
				default:
					this.update_playcount(metadb, new_playcount);
					break;
				}
				break;
			case "user.getLovedTracks":
				var data = _.jsonParse(this.xmlhttp.responsetext);
				if (this.page == 1) {
					if (data.error) {
						this.loved_working = false;
						return panel.console("Last.fm server error:\n\n" + data.message);
					}
					if (data.lovedtracks.totalPages == 0)
						this.pages = 0;
					else
						this.pages = data.lovedtracks["@attr"].totalPages;
				}
				data = _.get(data, "lovedtracks.track", []);
				if (_.isUndefined(data.length))
					data = [data];
				if (data.length > 0) {
					_.forEach(data, function (item) {
						var artist = item.artist.name;
						var title = item.name;
						var url = _.tfe("l$crc32($lower(" + _.fbEscape(artist + title) + "))", true);
						panel.console(this.r + ": " + artist + " - " + title);
						this.sql += "INSERT OR REPLACE INTO quicktag(url,subsong,fieldname,value) VALUES('" + url + "','-1','LASTFM_LOVED_DB','1');\r\n";
						this.r++;
					}, this);
					panel.console("Loved tracks: completed page " + this.page + " of " + this.pages);
				} else if (this.pages > 0) {
					this.loved_page_errors++;
				}
				if (this.page < this.pages) {
					this.page++;
					this.get("user.getLovedTracks", null, this.page);
				} else {
					this.loved_working = false;
					switch (true) {
					case this.full_import:
						this.playcount_working = true;
						this.pages = 0;
						this.r = 1;
						this.get("library.getTracks", null, 1);
						break;
					case this.sql == "BEGIN TRANSACTION;\r\n":
						panel.console("Nothing found to import.");
						break;
					default:
						this.sql += "COMMIT;";
						_.save(this.sql, this.sql_file);
						this.finish_import();
						break;
					}
				}
				break;
			case "library.getTracks":
				var data = _.jsonParse(this.xmlhttp.responsetext);
				if (this.page == 1) {
					if (data.error) {
						this.playcount_working = false;
						return panel.console("Last.fm server error:\n\n" + data.message);
					}
					if (data.tracks.totalPages == 0)
						this.pages = 0;
					else
						this.pages = data.tracks["@attr"].totalPages;
				}
				data = _.get(data, "tracks.track", []);
				if (_.isUndefined(data.length))
					data = [data];
				if (data.length > 0) {
					_.forEach(data, function (item) {
						var playcount = item.playcount;
						if (playcount > 0) {
							var artist = item.artist.name;
							var title = item.name;
							var url = _.tfe("p$crc32($lower(" + _.fbEscape(artist + title) + "))", true);
							panel.console(this.r + ": " + artist + " - " + title + " " + playcount);
							this.sql += "INSERT OR REPLACE INTO quicktag(url,subsong,fieldname,value) VALUES('" + url + "','-1','LASTFM_PLAYCOUNT_DB','" + playcount + "');\r\n";
							this.r++;
						} else {
							this.page = this.pages;
						}
					}, this);
					panel.console("Playcount: completed page " + this.page + " of " + this.pages);
				} else if (this.pages > 0) {
					this.playcount_page_errors++
				}
				if (this.page < this.pages) {
					this.page++;
					this.get("library.getTracks", null, this.page);
				} else {
					this.playcount_working = false;
					if (this.sql == "BEGIN TRANSACTION;\r\n") {
						panel.console("Nothing found to import.");
					} else {
						this.sql += "COMMIT;";
						_.save(this.sql, this.sql_file);
						this.finish_import();
					}
				}
				break;
			}
		}
		
		this.update_playcount = function (metadb, new_value) {
			panel.console("Attempting to update database...");
			fb.RunContextCommandWithMetadb("Customdb Delete Playcount", metadb, 8);
			window.SetTimeout(_.bind(function () {
				var crc32 = _.tf("p$crc32($lower(%artist%%title%))", metadb);
				var cmd = _.shortPath(this.sqlite3_file) + " " + _.shortPath(this.db_file) + " \"INSERT INTO quicktag(url,subsong,fieldname,value) VALUES('" + crc32 + "','-1','LASTFM_PLAYCOUNT_DB','" + new_value + "');\"";
				var attempt = 1;
				while (_.tf("%LASTFM_PLAYCOUNT_DB%", metadb) != new_value && attempt <= 10) {
					panel.console("Attempt: " + attempt);
					_.runCmd(cmd, true);
					attempt++;
				}
				if (_.tf("%LASTFM_PLAYCOUNT_DB%", metadb) == new_value) {
					panel.console("Database updated successfully.");
					fb.RunContextCommandWithMetadb("Customdb Refresh", metadb, 8);
				} else {
					panel.console("Database error. Playcount not updated.");
				}
			}, this), 250);
		}
		
		this.start_import = function () {
			fb.ShowConsole();
			this.loved_page_errors = 0;
			this.playcount_page_errors = 0;
			this.pages = 0;
			this.r = 1;
			this.sql = "BEGIN TRANSACTION;\r\n";
			this.loved_working = true;
			panel.console("Starting import...");
			this.get("user.getLovedTracks", null, 1);
		}
		
		this.finish_import = function () {
			switch (true) {
			case !this.full_import && this.loved_page_errors > 0:
				panel.console("Loved track page errors: " + this.loved_page_errors + " (200 records are lost for every page that fails.)");
				break;
			case this.full_import && this.loved_page_errors + this.playcount_page_errors > 0:
				panel.console("Loved track page errors: " + this.loved_page_errors + " (200 records are lost for every page that fails.)");
				panel.console("Playcount page errors: " + this.playcount_page_errors + " (100 records are lost for every page that fails.)");
				break;
			default:
				panel.console("There were no errors reported.");
				break;
			}
			_.run(_.shortPath(this.cmd_file), _.shortPath(this.sqlite3_file), _.shortPath(this.db_file), _.shortPath(this.sql_file));
		}
		
		this.update_button = function () {
			var n = "mono\\appbar.warning.circle.png";
			switch (true) {
			case lastfm.username.length == 0:
				var tooltip = "Click to set your username.";
				break;
			case lastfm.sk.length != 32:
				var tooltip = "Click to set your password.";
				break;
			case !this.enabled:
				var tooltip = "Click to enable.";
				break;
			default:
				n = "mono\\appbar.social.lastfm.png";
				var tooltip = "Last.fm Settings";
				break;
			}
			buttons.buttons.scrobbler = new _.button(this.x, this.y, this.size, this.size, {normal : n}, _.bind(function () { this.menu(); }, this), tooltip);
			window.RepaintRect(this.x, this.y, this.size, this.size);
		}
		
		this.menu = function () {
			var m = window.CreatePopupMenu();
			var s = window.CreatePopupMenu();
			var working = this.loved_working || this.playcount_working;
			var flag = working || lastfm.username.length == 0 ? MF_GRAYED : MF_STRING;
			m.AppendMenuItem(working ? MF_GRAYED : MF_STRING, 1, "Last.fm username...");
			m.AppendMenuItem(flag, 2, "Last.fm password...");
			m.AppendMenuSeparator();
			m.AppendMenuItem(flag, 3, "Enabled");
			m.CheckMenuItem(3, this.enabled);
			m.AppendMenuSeparator();
			s.AppendMenuItem(flag, 4, "loved tracks and playcount");
			s.AppendMenuItem(flag, 5, "loved tracks only");
			s.AppendTo(m, MF_STRING, "Library import");
			m.AppendMenuSeparator();
			m.AppendMenuItem(MF_STRING, 6, "Show loved tracks");
			m.AppendMenuSeparator();
			m.AppendMenuItem(lastfm.username.length > 0 ? MF_STRING : MF_GRAYED, 7, "View profile");
			var idx = m.TrackPopupMenu(this.x, this.y + this.size);
			switch (idx) {
			case 1:
				lastfm.update_username();
				break;
			case 2:
				lastfm.update_password();
				break;
			case 3:
				this.enabled = !this.enabled;
				window.SetProperty("2K3.SCROBBLER.ENABLED", this.enabled);
				this.update_button();
				break;
			case 4:
			case 5:
				this.full_import = idx == 4;
				this.start_import();
				break;
			case 6:
				fb.ShowLibrarySearchUI("%LASTFM_LOVED_DB% IS 1");
				break;
			case 7:
				_.browser("http://www.last.fm/user/" + lastfm.username);
				break;
			}
			m.Dispose();
			s.Dispose();
		}
		
		this.interval_func = _.bind(function () {
			if (!this.loved_working && !this.playcount_working)
				return;
			if (this.page != this.last_page)
				return this.last_page = this.page;
			var temp = this.page > 1 ? this.page - 1 : 1;
			this.xmlhttp.abort();
			if (this.loved_working)
				this.get("user.getLovedTracks", null, temp);
			else if (this.playcount_working)
				this.get("library.getTracks", null, temp);
		}, this);
		
		lastfm.scrobbler = this;
		_.createFolder(folders.data);
		_.createFolder(folders.lastfm);
		_.createFolder(folders.settings);
		this.x = x;
		this.y = y;
		this.size = size;
		this.loved_working = false;
		this.playcount_working = false;
		this.min_length = 30;
		this.sqlite3_file = folders.home + "sqlite3.exe";
		this.cmd_file = folders.home + "lastfm_sql.cmd";
		this.db_file = fb.ProfilePath + "customdb_sqlite.db";
		this.sql_file = folders.data + "lastfm.sql";
		this.page = 0;
		this.last_page = 0;
		this.enabled = window.GetProperty("2K3.SCROBBLER.ENABLED", true);
		this.xmlhttp = new ActiveXObject("Microsoft.XMLHTTP");
		window.SetInterval(this.interval_func, 15000);
	}
});
