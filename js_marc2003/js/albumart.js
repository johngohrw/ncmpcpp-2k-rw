_.mixin({
	albumart : function (x, y, w, h) {
		this.paint = function (gr) {
			if (this.cd) {
				if (this.shadow)
					_.drawImage(gr, this.shadow_img, this.x, this.y, this.w, this.h);
				_.drawImage(gr, this.case_img, this.x, this.y, this.w, this.h);
				if (this.img) {
					var ratio = Math.min(this.w / this.case_img.Width, this.h / this.case_img.Height);
					var nw = 488 * ratio;
					var nh = 476 * ratio;
					var nx = this.x + _.floor((this.w - (452 * ratio)) / 2);
					var ny = this.y + _.floor((this.h - nh) / 2);
					_.drawImage(gr, this.img, nx, ny, nw, nh, image.crop_top);
				}
				_.drawImage(gr, this.semi_img, this.x, this.y, this.w, this.h);
				if (this.gloss)
					_.drawImage(gr, this.gloss_img, this.x, this.y, this.w, this.h);
			} else if (this.img) {
				_.drawImage(gr, this.img, this.x, this.y, this.w, this.h, this.aspect);
			}
		}
		
		this.metadb_changed = function () {
			if (panel.metadb) {
				this.img && this.img.Dispose();
				this.tooltip = "";
				this.path = "";
				this.img = utils.GetAlbumArtV2(panel.metadb, this.id);
				window.Repaint();
				utils.GetAlbumArtAsync(window.ID, panel.metadb, this.id, true, false, true);
			}
		}
		
		this.get_album_art_done = function (p) {
			this.path = p;
			if (this.img && panel.metadb && _.isFile(this.path)) {
				this.tooltip = "Original dimensions: " + this.img.Width + "x" + this.img.Height + "px\nPath: " + this.path;
				if (this.path != panel.metadb.Path)
					this.tooltip += "\nSize: " + utils.FormatFileSize(fso.GetFile(this.path).Size);
			}
		}
		
		this.trace = function (x, y) {
			return x > this.x && x < this.x + this.w && y > this.y && y < this.y + this.h;
		}
		
		this.wheel = function (s) {
			if (this.trace(this.mx, this.my)) {
				this.id -= s;
				if (this.id < 0)
					this.id = 4;
				if (this.id > 4)
					this.id = 0;
				_.tt("");
				window.SetProperty("2K3.ARTREADER.ID", this.id);
				panel.item_focus_change();
				return true;
			} else {
				return false;
			}
		}
		
		this.move = function (x, y) {
			this.mx = x;
			this.my = y;
			if (this.trace(x, y)) {
				if (this.img)
					_.tt(this.tooltip);
				this.hover = true;
				return true;
			} else {
				if (this.hover)
					_.tt("");
				this.hover = false;
				return false;
			}
		}
		
		this.lbtn_dblclk = function (x, y) {
			switch (true) {
			case !this.trace(x, y):
				return false;
			case this.path == panel.metadb.Path:
				_.explorer(this.path);
				break;
			case _.isFile(this.path):
				_.run(this.path);
				break;
			}
			return true;
		}
		
		this.rbtn_up = function (x, y) {
			panel.m.AppendMenuItem(MF_STRING, 2000, "Refresh");
			panel.m.AppendMenuSeparator();
			panel.m.AppendMenuItem(MF_STRING, 2001, "CD Jewel Case");
			panel.m.CheckMenuItem(2001, this.cd);
			panel.m.AppendMenuItem(this.cd ? MF_STRING : MF_GRAYED, 2002, "Gloss effect");
			panel.m.CheckMenuItem(2002, this.gloss);
			panel.m.AppendMenuItem(this.cd ? MF_STRING : MF_GRAYED, 2003, "Shadow effect");
			panel.m.CheckMenuItem(2003, this.shadow);
			panel.m.AppendMenuSeparator();
			_.forEach(this.ids, function (item, i) {
				panel.m.AppendMenuItem(MF_STRING, i + 2010, item);
			});
			panel.m.CheckMenuRadioItem(2010, 2014, this.id + 2010);
			panel.m.AppendMenuSeparator();
			if (!this.cd) {
				panel.m.AppendMenuItem(MF_STRING, 2020, "Crop (focus on centre)");
				panel.m.AppendMenuItem(MF_STRING, 2021, "Crop (focus on top)");
				panel.m.AppendMenuItem(MF_STRING, 2022, "Stretch");
				panel.m.AppendMenuItem(MF_STRING, 2023, "Centre");
				panel.m.CheckMenuRadioItem(2020, 2023, this.aspect + 2020);
				panel.m.AppendMenuSeparator();
			}
			panel.m.AppendMenuItem(_.isFile(this.path) ? MF_STRING : MF_GRAYED, 2030, "Open containing folder");
			panel.m.AppendMenuSeparator();
			panel.m.AppendMenuItem(panel.metadb ? MF_STRING : MF_GRAYED, 2040, "Google image search");
			panel.m.AppendMenuSeparator();
		}
		
		this.rbtn_up_done = function (idx) {
			switch (idx) {
			case 2000:
				panel.item_focus_change();
				break;
			case 2001:
				this.cd = !this.cd;
				window.SetProperty("2K3.ARTREADER.CD", this.cd);
				window.Repaint();
				break;
			case 2002:
				this.gloss = !this.gloss;
				window.SetProperty("2K3.ARTREADER.GLOSS", this.gloss);
				window.RepaintRect(this.x, this.y, this.w, this.h);
				break;
			case 2003:
				this.shadow = !this.shadow;
				window.SetProperty("2K3.ARTREADER.SHADOW", this.shadow);
				window.RepaintRect(this.x, this.y, this.w, this.h);
				break;
			case 2010:
			case 2011:
			case 2012:
			case 2013:
			case 2014:
				this.id = idx - 2010;
				window.SetProperty("2K3.ARTREADER.ID", this.id);
				panel.item_focus_change();
				break;
			case 2020:
			case 2021:
			case 2022:
			case 2023:
				this.aspect = idx - 2020;
				window.SetProperty("2K3.ARTREADER.ASPECT", this.aspect);
				window.RepaintRect(this.x, this.y, this.w, this.h);
				break;
			case 2030:
				_.explorer(this.path);
				break;
			case 2040:
				_.browser("https://www.google.co.uk/search?tbm=isch&q=" + encodeURIComponent(panel.tf("%album artist%[ %album%]")));
				break;
			}
		}
		
		this.key_down = function (k) {
			switch (k) {
			case VK_LEFT:
			case VK_UP:
				this.wheel(1);
				return true;
			case VK_RIGHT:
			case VK_DOWN:
				this.wheel(-1);
				return true;
			default:
				return false;
			}
		}
		
		this.x = x;
		this.y = y;
		this.w = w;
		this.h = h;
		this.mx = 0;
		this.my = 0;
		this.tooltip = "";
		this.ids = ["Front", "Back", "Disc", "Icon", "Artist"];
		this.id = window.GetProperty("2K3.ARTREADER.ID", 0);
		this.aspect = window.GetProperty("2K3.ARTREADER.ASPECT", image.crop);
		this.cd = window.GetProperty("2K3.ARTREADER.CD", false);
		this.shadow = window.GetProperty("2K3.ARTREADER.SHADOW", false);
		this.gloss = window.GetProperty("2K3.ARTREADER.GLOSS", false);
		this.shadow_img = _.img("cd\\shadow.png");
		this.case_img = _.img("cd\\case.png");
		this.semi_img = _.img("cd\\semi.png");
		this.gloss_img = _.img("cd\\gloss.png");
		this.img = null;
		this.path = null;
		this.hover = false;
	}
});
