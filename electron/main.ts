import { app, BrowserWindow, ipcMain, dialog, shell, protocol } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import { DatabaseManager } from './database'
import { MusicScanner } from './musicScanner'
import { PlaylistManager } from './playlistManager'
import { LastFmService } from './lastfmService'
import { DownloadService } from './downloadService'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let mainWindow: BrowserWindow | null = null
let dbManager: DatabaseManager
let musicScanner: MusicScanner
let playlistManager: PlaylistManager
let lastFmService: LastFmService
let downloadService: DownloadService

// Last.fm API credentials (obtenlas de https://www.last.fm/api/account/create)
const LASTFM_API_KEY = 'TU_API_KEY_AQUI'
const LASTFM_API_SECRET = 'TU_API_SECRET_AQUI'

// Settings storage
interface AppSettings {
  lastfm?: {
    sessionKey?: string
    username?: string
    scrobbleEnabled?: boolean
  }
  downloadPath?: string
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    frame: true,
    backgroundColor: '#121212',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(async () => {
  // Register local file protocol
  protocol.registerFileProtocol('local-file', (request, callback) => {
    const url = request.url.replace('local-file://', '')
    const decodedPath = decodeURIComponent(url)
    callback({ path: decodedPath })
  })

  // Initialize database
  const dbPath = path.join(app.getPath('userData'), 'jotify.db')
  dbManager = new DatabaseManager(dbPath)
  
  // Wait for database to be ready
  await dbManager.waitForReady()
  
  musicScanner = new MusicScanner(dbManager)
  playlistManager = new PlaylistManager(dbManager)
  
  // Initialize Last.fm service
  lastFmService = new LastFmService(LASTFM_API_KEY, LASTFM_API_SECRET)
  
  // Initialize download service
  downloadService = new DownloadService()
  
  // Load saved settings
  loadSettings()

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })

  setupIpcHandlers()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

function setupIpcHandlers() {
  // File dialog for selecting music folder
  ipcMain.handle('dialog:selectFolder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Selecciona la carpeta con tu música FLAC',
    })
    return result.filePaths[0]
  })

  // Scan music library
  ipcMain.handle('library:scan', async (_, folderPath: string) => {
    try {
      const tracks = await musicScanner.scanFolder(folderPath)
      return { success: true, count: tracks.length }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  // Get all tracks
  ipcMain.handle('library:getTracks', async () => {
    return dbManager.getAllTracks()
  })

  // Get track by ID
  ipcMain.handle('library:getTrack', async (_, id: number) => {
    return dbManager.getTrackById(id)
  })

  // Search tracks
  ipcMain.handle('library:search', async (_, query: string) => {
    return dbManager.searchTracks(query)
  })

  // Playlist management
  ipcMain.handle('playlist:create', async (_, name: string) => {
    return playlistManager.createPlaylist(name)
  })

  ipcMain.handle('playlist:getAll', async () => {
    return playlistManager.getAllPlaylists()
  })

  ipcMain.handle('playlist:getById', async (_, id: number) => {
    return playlistManager.getPlaylistById(id)
  })

  ipcMain.handle('playlist:addTrack', async (_, playlistId: number, trackId: number) => {
    return playlistManager.addTrackToPlaylist(playlistId, trackId)
  })

  ipcMain.handle('playlist:removeTrack', async (_, playlistId: number, trackId: number) => {
    return playlistManager.removeTrackFromPlaylist(playlistId, trackId)
  })

  // Last.fm handlers
  ipcMain.handle('lastfm:getAuthUrl', () => {
    return lastFmService.getAuthUrl()
  })

  ipcMain.handle('lastfm:authenticate', async (_, token: string) => {
    try {
      const session = await lastFmService.getSessionKey(token)
      saveSettings({
        lastfm: {
          sessionKey: session.sessionKey,
          username: session.username,
          scrobbleEnabled: true,
        }
      })
      return { success: true, username: session.username }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('lastfm:isAuthenticated', () => {
    return lastFmService.isAuthenticated()
  })

  ipcMain.handle('lastfm:getUsername', () => {
    return lastFmService.getUsername()
  })

  ipcMain.handle('lastfm:updateNowPlaying', async (_, track) => {
    try {
      await lastFmService.updateNowPlaying({
        artist: track.artist,
        track: track.title,
        album: track.album,
        albumArtist: track.albumArtist,
        duration: track.duration,
        timestamp: Date.now(),
      })
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('lastfm:scrobble', async (_, track, timestamp) => {
    try {
      await lastFmService.scrobble({
        artist: track.artist,
        track: track.title,
        album: track.album,
        albumArtist: track.albumArtist,
        duration: track.duration,
        timestamp: timestamp || Date.now(),
      })
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('lastfm:getTrackInfo', async (_, artist, track, album) => {
    try {
      const info = await lastFmService.getTrackInfo(artist, track, album)
      return info
    } catch (error) {
      console.error('Error fetching track info:', error)
      return null
    }
  })

  ipcMain.handle('lastfm:getSimilarTracks', async (_, artist, track, limit) => {
    try {
      const tracks = await lastFmService.getSimilarTracks(artist, track, limit)
      return tracks
    } catch (error) {
      console.error('Error fetching similar tracks:', error)
      return []
    }
  })

  ipcMain.handle('lastfm:getRecentTracks', async (_, limit) => {
    try {
      const tracks = await lastFmService.getRecentTracks(limit)
      return tracks
    } catch (error) {
      console.error('Error fetching recent tracks:', error)
      return []
    }
  })

  ipcMain.handle('lastfm:disconnect', () => {
    saveSettings({ lastfm: undefined })
    lastFmService = new LastFmService(LASTFM_API_KEY, LASTFM_API_SECRET)
    return { success: true }
  })

  // Download handlers
  ipcMain.handle('download:searchMusic', async (_, query, limit) => {
    try {
      const results = await downloadService.searchMusic(query, limit)
      return { success: true, results }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('download:getMediaInfo', async (_, url) => {
    try {
      const info = await downloadService.getMediaInfo(url)
      return { success: true, info }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('download:track', async (_, url, format) => {
    try {
      const settings = loadSettings()
      const outputPath = settings.downloadPath || app.getPath('music')
      
      await downloadService.downloadTrack({
        url,
        outputPath,
        format,
        extractAudio: true,
        onProgress: (progress) => {
          mainWindow?.webContents.send('download:progress', progress)
        }
      })

      // Scan the download folder to add new tracks
      await musicScanner.scanFolder(outputPath)
      const tracks = dbManager.getAllTracks()
      
      return { success: true, message: 'Descarga completada' }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('download:checkYtDlp', async () => {
    const isInstalled = await downloadService.checkYtDlpInstalled()
    return isInstalled
  })

  ipcMain.handle('download:updateYtDlp', async () => {
    const result = await downloadService.updateYtDlp()
    return result
  })

  ipcMain.handle('download:selectOutputPath', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Selecciona la carpeta de descargas',
    })
    if (!result.canceled && result.filePaths[0]) {
      saveSettings({ downloadPath: result.filePaths[0] })
      return result.filePaths[0]
    }
    return null
  })

  // Settings handlers
  ipcMain.handle('settings:get', () => {
    return loadSettings()
  })

  ipcMain.handle('settings:save', (_, settings) => {
    saveSettings(settings)
    return { success: true }
  })

  // Open external links
  ipcMain.handle('shell:openExternal', (_, url) => {
    shell.openExternal(url)
  })

  ipcMain.handle('playlist:rename', async (_, id: number, name: string) => {
    return playlistManager.renamePlaylist(id, name)
  })

  // Get app version
  ipcMain.handle('app:getVersion', () => {
    return app.getVersion()
  })
}

// Settings persistence
function getSettingsPath(): string {
  return path.join(app.getPath('userData'), 'settings.json')
}

function loadSettings(): AppSettings {
  try {
    const settingsPath = getSettingsPath()
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, 'utf-8')
      const settings = JSON.parse(data)
      
      // Restore Last.fm session if available
      if (settings.lastfm?.sessionKey && settings.lastfm?.username) {
        lastFmService.setSession(settings.lastfm.sessionKey, settings.lastfm.username)
      }
      
      return settings
    }
  } catch (error) {
    console.error('Error loading settings:', error)
  }
  return {}
}

function saveSettings(newSettings: Partial<AppSettings>) {
  try {
    const currentSettings = loadSettings()
    const updatedSettings = { ...currentSettings, ...newSettings }
    const settingsPath = getSettingsPath()
    fs.writeFileSync(settingsPath, JSON.stringify(updatedSettings, null, 2))
  } catch (error) {
    console.error('Error saving settings:', error)
  }
}
