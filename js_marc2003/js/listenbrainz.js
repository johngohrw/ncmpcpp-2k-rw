_.mixin({
	listenbrainz : function (x, y, size) {
		this.playback_new_track = function() {
			this.time_elapsed = 0;
			this.target_time = Math.min(_.ceil(fb.PlaybackLength / 2), 240);
		}
		
		this.playback_time = function () {
			this.time_elapsed++;
			if (this.time_elapsed == this.target_time)
				this.listen();
		}
		
		this.listen = function () {
			if (this.token.length != 36)
				return panel.console("Token not set.");
			
			var metadb = fb.GetNowPlaying();
			if (!metadb)
				return;
			
			if (this.library && !fb.IsMetadbInMediaLibrary(metadb))
				return panel.console("Skipping... Track not in Media Library.");
			
			var timestamp = _.floor(_.now() / 1000);
			
			var tags = this.get_tags(metadb);
			
			if (!tags.artist || !tags.title)
				return panel.console("Artist/title tag missing. Not submitting.");
			
			var data = {
				listen_type : "single",
				payload : [{
					listened_at : timestamp,
					track_metadata : {
						additional_info : {
							artist_mbids : _.isString(tags.musicbrainz_artistid) ? [tags.musicbrainz_artistid] : tags.musicbrainz_artistid,
							date : tags.date,
							discnumber : tags.discnumber,
							recording_mbid : tags.musicbrainz_trackid,
							release_group_mbid : tags.musicbrainz_releasegroupid,
							release_mbid : tags.musicbrainz_albumid,
							tags : _.isString(tags.genre) ? [tags.genre] : tags.genre,
							totaldiscs : tags.totaldiscs,
							totaltracks: tags.totaltracks,
							track_mbid : tags.musicbrainz_releasetrackid,
							tracknumber : tags.tracknumber,
							work_mbids : _.isString(tags.musicbrainz_workid) ? [tags.musicbrainz_workid] : tags.musicbrainz_workid
						},
						artist_name : tags.artist,
						release_name : tags.album,
						track_name : tags.title
					}
				}]
			};
			
			panel.console("Submitting '" + tags.artist + " - " + tags.title + "'");
			
			if (this.show_data) {
				//spam the console!
				fb.trace(JSON.stringify(data, null, "    "));
			}
			
			if (this.log_data)
				this.log(data);
			
			this.post(data);
		}
		
		this.log = function (data) {
			var d = new Date();
			var f = this.folder + _.padLeft(d.getMonth() + 1, 2, 0) + "." + d.getFullYear() + ".json";
			if (_.isFile(f)) {
				var json = _.jsonParse(_.open(f));
				if (json.payload)
					json = json.payload;
			} else {
				var json = [];
			}
			json.unshift(data.payload[0]);
			_.save(JSON.stringify(json), f);
		}
		
		this.post = function (data) {
			this.xmlhttp.open("POST", "https://api.listenbrainz.org/1/submit-listens", true);
			this.xmlhttp.setRequestHeader("Content-type", "application/json;charset=UTF-8");
			this.xmlhttp.setRequestHeader("Authorization" , "Token " + this.token);
			this.xmlhttp.send(JSON.stringify(data));
			this.xmlhttp.onreadystatechange = _.bind(function () {
				if (this.xmlhttp.readyState == 4) {
					panel.console("HTTP status: " + this.xmlhttp.status);
					this.xmlhttp.responsetext && panel.console(this.xmlhttp.responsetext);
				}
			}, this);
		}
		
		this.get_tags = function (metadb) {
			var tmp = {};
			var f = metadb.GetFileInfo();
			for (var i = 0; i < f.MetaCount; i++) {
				var name = f.MetaName(i).toLowerCase();
				if (!this.submit_genres && name == "genre")
					continue;
				
				if (_.isString(this.mb_names[name]))
					var key = this.mb_names[name];
				else
					var key = name;
				
				var num = f.MetaValueCount(i);
				if (num == 1) {
					tmp[key] = f.MetaValue(i, 0);
				} else {
					tmp[key] = [];
					for (var j = 0; j < num; j++) {
						tmp[key].push(f.MetaValue(i, j));
					}
				}
			}
			return tmp;
		}
		
		this.options = function () {
			var flag = this.token.length == 36 ? MF_STRING : MF_GRAYED;
			var m = window.CreatePopupMenu();
			m.AppendMenuItem(MF_STRING, 1, "Set token...");
			m.AppendMenuSeparator();
			m.AppendMenuItem(MF_STRING, 2, "Set username...");
			m.AppendMenuItem(this.username.length > 0 ? MF_STRING : MF_GRAYED, 3, "View profile");
			m.AppendMenuSeparator();
			m.AppendMenuItem(flag, 4, "Show data before sending");
			m.CheckMenuItem(4, this.show_data)
			m.AppendMenuItem(flag, 5, "Save data to external file");
			m.CheckMenuItem(5, this.log_data);
			m.AppendMenuItem(flag, 6, "Submit library tracks only");
			m.CheckMenuItem(6, this.library);
			m.AppendMenuItem(flag, 7, "Submit genre tags");
			m.CheckMenuItem(7, this.submit_genres);
			var idx = m.TrackPopupMenu(this.x, this.y + this.size);
			switch (idx) {
			case 1:
				var token = _.input("Enter your token\n\nhttp://listenbrainz.org/user/import", panel.name, this.token);
				if (token != this.token) {
					this.token = token;
					utils.WriteINI(this.ini_file, "Listenbrainz", "token", this.token);
					this.update_button();
				}
				break;
			case 2:
				var username = _.input("Enter your username.", panel.name, this.username);
				if (username != this.username) {
					this.username = username;
					utils.WriteINI(this.ini_file, "Listenbrainz", "username", this.username);
				}
				break;
			case 3:
				_.browser("http://listenbrainz.org/user/" + this.username);
				break;
			case 4:
				this.show_data = !this.show_data;
				window.SetProperty("2K3.LISTENBRAINZ.SHOW.DATA", this.show_data);
				break;
			case 5:
				this.log_data = !this.log_data;
				window.SetProperty("2K3.LISTENBRAINZ.LOG.DATA", this.log_data);
				break;
			case 6:
				this.library = !this.library;
				window.SetProperty("2K3.LISTENBRAINZ.LIBRARY", this.library);
				break;
			case 7:
				this.submit_genres = !this.submit_genres;
				window.SetProperty("2K3.LISTENBRAINZ.SUBMIT.GENRES", this.submit_genres);
				break;
			}
			m.Dispose();
		}
		
		this.update_button = function () {
			buttons.buttons.listenbrainz = new _.button(this.x, this.y, this.size, this.size, {normal : listenbrainz.token.length == 36 ? "misc\\listenbrainz_active.png" : "misc\\listenbrainz_inactive.png"}, _.bind(function () { this.options(); }, this), "Listenbrainz Options");
			window.RepaintRect(this.x, this.y, this.size, this.size);
		}
		
		this.folder = fb.ProfilePath + "listenbrainz\\";
		_.createFolder(this.folder);
		_.createFolder(folders.settings);
		this.x = x;
		this.y = y;
		this.size = size;
		this.ini_file = folders.settings + "listenbrainz.ini";
		this.token = utils.ReadINI(this.ini_file, "Listenbrainz", "token");
		this.username = utils.ReadINI(this.ini_file, "Listenbrainz", "username");
		this.show_data = window.GetProperty("2K3.LISTENBRAINZ.SHOW.DATA", false);
		this.log_data = window.GetProperty("2K3.LISTENBRAINZ.LOG.DATA", true);
		this.library = window.GetProperty("2K3.LISTENBRAINZ.LIBRARY", false);
		this.submit_genres = window.GetProperty("2K3.LISTENBRAINZ.SUBMIT.GENRES", true);
		this.xmlhttp = new ActiveXObject("Microsoft.XMLHTTP");
		this.time_elapsed = 0;
		this.target_time = 0;
		this.timestamp = 0;
		this.mb_names = {
			"acoustid id" : "acoustid_id",
			"acoustid fingerprint" : "acoustid_fingerprint",
			"album artist" : "albumartist",
			"albumartistsortorder" : "albumartistsort",
			"albumsortorder" : "albumsort",
			"artistsortorder" : "artistsort",
			"artist webpage url" : "website",
			"composersortorder" : "composersort",
			"content group" : "grouping",
			"copyright url" : "license",
			"encoded by" : "encodedby",
			"encoding settings" : "encodersettings",
			"initial key" : "initialkey",
			"itunescompilation" : "compilation",
			"musicbrainz album artist id" : "musicbrainz_albumartistid",
			"musicbrainz album id" : "musicbrainz_albumid",
			"musicbrainz artist id" : "musicbrainz_artistid",
			"musicbrainz disc id" : "musicbrainz_discid",
			"musicbrainz release group id" : "musicbrainz_releasegroupid",
			"musicbrainz release track id" : "musicbrainz_releasetrackid",
			"musicbrainz trm id" : "musicbrainz_trmid",
			"musicbrainz work id" : "musicbrainz_workid",
			"musicip puid" : "musicip_puid",
			"musicbrainz album release country" : "releasecountry",
			"musicbrainz album status" : "releasestatus",
			"musicbrainz album type" : "releasetype",
			"titlesortorder" : "titlesort"
		}
	}
});
