const pptr = require('puppeteer');
const { exec } = require('child_process');

(async () => {
  if (process.argv.length < 3) {
    console.error(`请输入播放列表id，如: $ node main.js 698720887`)
    return;
  }

  const playlistID = process.argv[2];

  const browser = await pptr.launch({
    headless: true, // 使用无头模式
  });

  const page = await browser.newPage();


  //使用模拟器打开页面 emulate iPhoneX
  const iPhone = pptr.KnownDevices['iPhone X'];
  await page.emulate(iPhone)
  await page.goto(`https://y.music.163.com/m/playlist?id=${playlistID}`);


  const PlayListData = await page.evaluate(() => {
    return window?.REDUX_STATE?.Playlist?.data ?? null;
  });

  if (PlayListData)
    curl_download(PlayListData);


  await browser.close();
})();

/**
 * 使用递归下载播放列表
 * @param {any[]} PlayListData 
 * @returns 
 */
function curl_download(PlayListData) {
  if (!PlayListData.length) return;

  let song = PlayListData[0];

  const nextDownloadSong = () => {
    return curl_download(PlayListData.slice(1));
  }

  if (song.priMode.msg && song.priMode.msg.includes("会员")) {
    console.log(`跳过会员歌曲下载: ${song.singerName}-${song.songName}\n`);
    return nextDownloadSong()
  }

  let saveSongName = `${song.singerName}-${song.songName}`;

  // 避免出现 / 目录分隔符
  saveSongName = saveSongName.replace(/\//g, "&")

  // curl http://music.163.com/song/media/outer/url?id=1392971370.mp3 -L -o 失乐.mp3
  exec(`curl http://music.163.com/song/media/outer/url?id=${song.id}.mp3 --create-dirs -L -o "./download/${saveSongName}.mp3"`, (err, stdout, stderr) => {

    // console.log(`stdout: ${stdout}\nstderr: ${stderr}\n`);

    if (err) {
      console.log(`下载失败: ${song.singerName}-${song.songName}\n`);
      return nextDownloadSong()
    }
    console.log(`下载成功: ${song.singerName}-${song.songName}\n`);
    return nextDownloadSong()
  });
}