import { app, BrowserWindow, net, protocol, shell } from 'electron'
import { join, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { closeDb, openDb } from './db'
import { audioRoot } from './paths'
import { registerIpcHandlers } from './ipc/handlers'
import { AUDIO_SCHEME } from './services/audioUrl'
import { tts } from './services/tts/kokoroProvider'
import { applyDataDirOverride } from './dataLocation'
import { retryMissingRescues } from './services/leechService'
import { clusterPendingVocab } from './services/unitService'

// Nếu người dùng đã chuyển dữ liệu sang ổ khác (ví dụ ổ D) thì dùng thư mục đó
applyDataDirOverride()

// Đăng ký custom protocol app-audio:// TRƯỚC khi app sẵn sàng.
// Renderer phát mp3 qua protocol này, nhờ vậy không phải tắt webSecurity.
protocol.registerSchemesAsPrivileged([
  { scheme: AUDIO_SCHEME, privileges: { standard: true, secure: true, stream: true, supportFetchAPI: true } }
])

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    title: 'Luyện Nghe',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true, // bắt buộc: tách biệt renderer và preload
      nodeIntegration: false, // renderer không dùng được Node
      sandbox: true,
      // Thu nhỏ cửa sổ vẫn nghe tiếp được (mặc định Chromium tạm dừng media/hẹn giờ ở cửa sổ ẩn để tiết kiệm pin)
      backgroundThrottling: false
    }
  })
  mainWindow.on('ready-to-show', () => mainWindow?.show())

  // Link ngoài (nếu có) mở bằng trình duyệt, không mở trong app
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })

  // Chế độ dev: electron-vite cung cấp URL của dev server; bản build: mở file html
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// app-audio://audio/12/003.mp3 → <userData>/audio/12/003.mp3
// Kiểm tra kỹ để renderer không đọc được file nằm ngoài thư mục audio.
function registerAudioProtocol(): void {
  const root = resolve(audioRoot())
  protocol.handle(AUDIO_SCHEME, (request) => {
    const url = new URL(request.url)
    const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '')
    const filePath = resolve(root, rel)
    if (!filePath.startsWith(root + sep) || !filePath.toLowerCase().endsWith('.mp3')) {
      return new Response('Forbidden', { status: 403 })
    }
    return net.fetch(pathToFileURL(filePath).toString())
  })
}

// Chỉ cho chạy một cửa sổ app (mở lần 2 thì đưa cửa sổ cũ lên)
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(() => {
    openDb()
    retryMissingRescues() // từ hay quên chưa có nội dung cứu trợ (lần trước mất mạng) → tạo bù ở nền
    void clusterPendingVocab() // thẻ chưa xếp vào đơn vị nghĩa (thẻ cũ, hoặc lần trước mất mạng) → xếp ở nền
    registerAudioProtocol()
    registerIpcHandlers(() => mainWindow)
    createWindow()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    tts.kill()
    closeDb()
    app.quit()
  })
}
