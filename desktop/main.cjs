// Desktop shell (Electron): runs the built game in its own window with the GPU forced on. Not tested in CI.
const { app, BrowserWindow } = require('electron'); const path = require('path'); const http = require('http'); const fs = require('fs');
app.commandLine.appendSwitch('ignore-gpu-blocklist'); app.commandLine.appendSwitch('enable-gpu-rasterization'); app.commandLine.appendSwitch('enable-zero-copy'); app.commandLine.appendSwitch('disable-frame-rate-limit');
app.commandLine.appendSwitch('use-angle', process.platform === 'win32' ? 'd3d11' : 'default');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.glb': 'model/gltf-binary', '.exr': 'application/octet-stream', '.ogg': 'audio/ogg', '.woff2': 'font/woff2', '.json': 'application/json' };
function serve(dir) { // a tiny static server: the game fetches models/audio, which file:// would block
  return new Promise(res => { const srv = http.createServer((q, r) => { let f = path.join(dir, decodeURIComponent(q.url.split('?')[0])); if (f.endsWith(path.sep) || !fs.existsSync(f)) f = path.join(dir, 'index.html'); r.setHeader('Content-Type', MIME[path.extname(f)] || 'application/octet-stream'); fs.createReadStream(f).pipe(r); }).listen(0, '127.0.0.1', () => res(srv.address().port)); });
}
app.whenReady().then(async () => {
  const port = await serve(path.join(__dirname, '..', 'dist')); const w = new BrowserWindow({ width: 1600, height: 900, fullscreen: true, backgroundColor: '#000', autoHideMenuBar: true, webPreferences: { backgroundThrottling: false } });
  w.loadURL(`http://127.0.0.1:${port}/`); w.webContents.on('before-input-event', (e, i) => { if (i.key === 'F11' && i.type === 'keyDown') w.setFullScreen(!w.isFullScreen()); });
});
app.on('window-all-closed', () => app.quit());
