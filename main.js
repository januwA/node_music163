const pptr = require('puppeteer');
const { exec } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

class PlayListDownload {
  strategy = null; // 下载策略
  playListData = null; // 数据列表
  downloadDir = null; // 下载保存目录

  constructor(playListData, downloadDir = "./download") {
    this.playListData = playListData;
    this.downloadDir = downloadDir;
  }

  setStrategy(strategy) {
    this.strategy = strategy;
  }

  startDownload() {
    if (!this.strategy) return;

    if (!fs.existsSync(this.downloadDir)) fs.mkdirSync(this.downloadDir, { recursive: true });

    this._playListDownload(this.playListData);
  }


  /**
   * 使用递归下载播放列表
   * @param {any[]} playListData 
   * @returns 
   */
  _playListDownload(playListData) {
    if (!playListData.length) return;

    let song = playListData[0];

    const nextDownloadSong = () => {
      return this._playListDownload(playListData.slice(1));
    }

    // 避免出现 '/' 目录分隔符
    const saveSongName = `${song.singerName}-${song.songName}`.replace(/\//g, "&");

    if (song.priMode.msg && song.priMode.msg.includes("会员")) {
      console.log(`跳过会员歌曲下载: ${saveSongName}`);
      return nextDownloadSong()
    }

    this.strategy.download(song, path.join(this.downloadDir, `${saveSongName}.mp3`), nextDownloadSong);
  }
}

class DownloadStrategyBase {
  getSongDownloadUrl(song) {
    return `http://music.163.com/song/media/outer/url?id=${song.id}.mp3`
  }
}

class CurlDownloadStrategy extends DownloadStrategyBase {
  download(song, saveSongPath, doneCallback) {
    exec(`curl ${this.getSongDownloadUrl(song)} --create-dirs -L -o "${saveSongPath}"`, (err, stdout, stderr) => doneCallback());
  }
}

class HttpDownloadStrategy extends DownloadStrategyBase {
  /**
 * 
 * @param {string} url 
 * @param {(response: http.IncomingMessage) => any} callback 
 */
  _httpGetLocation(url, callback) {
    http.get(url, res => {
      const t = Math.floor(res.statusCode / 100);
      if (t == 2) {
        callback(res);
      } else if (t == 3) {
        this._httpGetLocation(res.headers.location, callback)
      } else {
        callback(null);
      }
    })
  }

  download(song, saveSongPath, doneCallback) {
    const file = fs.createWriteStream(saveSongPath);
    this._httpGetLocation(this.getSongDownloadUrl(song), res => {
      if (!res) return doneCallback();

      res.pipe(file);
      file.on("finish", () => {
        file.close();
        doneCallback();
      });
    })
  }
}

class Clint {
  _checkCmdArg() {
    if (process.argv.length < 3) {
      console.error(`请输入播放列表id，如: $ node main.js 698720887`)
      process.exit(1);
    }
  }

  async run() {
    this._checkCmdArg();

    const browser = await pptr.launch({
      headless: true, // 使用无头模式
    });

    const page = await browser.newPage();
    const iPhone = pptr.KnownDevices['iPhone X']; // emulate iPhoneX
    await page.emulate(iPhone)
    await page.goto(`https://y.music.163.com/m/playlist?id=${process.argv[2]}`);

    const playListData = await page.evaluate(() => {
      return window?.REDUX_STATE?.Playlist?.data ?? null;
    });

    if (playListData) {
      const dc = new PlayListDownload(playListData, "./download");
      dc.setStrategy(new HttpDownloadStrategy());
      dc.startDownload();
    }

    await browser.close();
  }
}

new Clint().run();