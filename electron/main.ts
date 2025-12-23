import { app, BrowserWindow, ipcMain, dialog, shell, protocol } from 'electron'
import path from 'path'
import { DatabaseManager } from './database'
import { MusicScanner } from './musicScanner'
import { PlaylistManager } from './playlistManager'
import { LastFmService } from './lastfmService'
import { DownloadService } from './downloadService'
import { MusicBrainzService } from './musicbrainzService'
import { parseFile } from 'music-metadata'
import fs from 'fs'

// Determinar el directorio correcto para recursos
// En desarrollo: dist/electron/ (compilado por vite-plugin-electron)
// En producción: dentro del asar en dist/electron/
const isDev = process.env.NODE_ENV === 'development'
const getResourcePath = () => {
  // Tanto en desarrollo como en producción, los archivos compilados están en dist/electron/
  // En desarrollo: vite-plugin-electron compila a dist/electron/
  // En producción: app.getAppPath() apunta a resources/app.asar
  return path.join(app.getAppPath(), 'dist', 'electron')
}

let mainWindow: BrowserWindow | null = null
let dbManager: DatabaseManager
let musicScanner: MusicScanner
let playlistManager: PlaylistManager
let lastFmService: LastFmService
let downloadService: DownloadService
let musicBrainzService: MusicBrainzService

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
  const resourcePath = getResourcePath()
  
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    frame: true,
    backgroundColor: '#121212',
    webPreferences: {
      preload: path.join(resourcePath, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    // En producción, index.html está en dist/ (un nivel arriba de dist/electron/)
    mainWindow.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'))
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
  
  // Initialize MusicBrainz service
  musicBrainzService = new MusicBrainzService()
  
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

  // Re-scan cover arts for tracks that don't have one
  ipcMain.handle('library:rescanCovers', async () => {
    try {
      const tracksWithoutCover = dbManager.getTracksWithoutCoverArt()
      let updatedCount = 0
      
      for (const track of tracksWithoutCover) {
        try {
          const coverArt = await musicScanner.extractCoverArt(track.filePath)
          if (coverArt && track.id) {
            dbManager.updateTrackCoverArt(track.id, coverArt)
            updatedCount++
            console.log(`[Main] Cover actualizado para: ${track.title}`)
          }
        } catch (err) {
          console.error(`[Main] Error actualizando cover para ${track.title}:`, err)
        }
      }
      
      return { success: true, count: updatedCount }
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

  // Search metadata in MusicBrainz
  ipcMain.handle('library:searchMetadata', async (_, artist: string, title: string) => {
    try {
      const result = await musicBrainzService.searchRecording(artist, title)
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  // Update track metadata
  ipcMain.handle('library:updateTrack', async (_, id: number, updates: { title?: string; artist?: string; album?: string; year?: number }) => {
    try {
      dbManager.updateTrackMetadata(id, updates)
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  // Search cover for a single track
  ipcMain.handle('library:searchCover', async (_, id: number) => {
    try {
      const track = dbManager.getTrackById(id)
      if (!track) {
        return { success: false, error: 'Track no encontrado' }
      }

      const audioDir = path.dirname(track.filePath)
      const audioName = path.basename(track.filePath, path.extname(track.filePath))
      const possibleCovers = ['.jpg', '.jpeg', '.png', '.webp']

      // Prioridad 1: Buscar en Cover Art Archive
      console.log(`[SearchCover] Buscando cover en Cover Art Archive para: ${track.artist} - ${track.title}`)
      const coverFromArchive = await musicBrainzService.searchAndDownloadCover(
        track.artist,
        track.title,
        audioDir
      )

      if (coverFromArchive) {
        dbManager.updateTrackCoverArt(track.id!, coverFromArchive)
        console.log(`[SearchCover] ✅ Cover descargado de Cover Art Archive: ${coverFromArchive}`)
        return { success: true, coverPath: coverFromArchive }
      }

      // Prioridad 2: Buscar archivo local con el mismo nombre que el audio
      for (const ext of possibleCovers) {
        const coverPath = path.join(audioDir, audioName + ext)
        if (fs.existsSync(coverPath)) {
          dbManager.updateTrackCoverArt(track.id!, coverPath)
          console.log(`[SearchCover] ✅ Encontrado cover local: ${coverPath}`)
          return { success: true, coverPath }
        }
      }

      // Prioridad 3: Extraer cover embebido del archivo de audio
      if (fs.existsSync(track.filePath)) {
        try {
          const metadata = await parseFile(track.filePath)
          if (metadata.common.picture && metadata.common.picture.length > 0) {
            const picture = metadata.common.picture[0]
            const ext = picture.format.includes('png') ? '.png' : '.jpg'
            const coverPath = path.join(audioDir, `${audioName}_cover${ext}`)
            fs.writeFileSync(coverPath, picture.data)
            dbManager.updateTrackCoverArt(track.id!, coverPath)
            console.log(`[SearchCover] ✅ Cover extraído del audio: ${coverPath}`)
            return { success: true, coverPath }
          }
        } catch (err) {
          console.error(`[SearchCover] Error extrayendo cover embebido: ${err}`)
        }
      }

      return { success: false, error: 'No se encontró cover' }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  // Delete track (from database and optionally from disk)
  ipcMain.handle('library:deleteTrack', async (_, id: number, deleteFromDisk: boolean = true) => {
    try {
      // Primero obtener la información del track para saber la ruta del archivo
      const track = dbManager.getTrackById(id)
      
      if (!track) {
        return { success: false, error: 'Track no encontrado' }
      }

      // Eliminar el archivo del disco si se solicita
      if (deleteFromDisk && track.filePath) {
        try {
          // Verificar si el archivo existe antes de intentar eliminarlo
          if (fs.existsSync(track.filePath)) {
            fs.unlinkSync(track.filePath)
            console.log('Archivo eliminado:', track.filePath)
            
            // También eliminar el thumbnail si existe (para archivos OPUS)
            const thumbnailPath = track.filePath.replace(/\.[^.]+$/, '.jpg')
            if (fs.existsSync(thumbnailPath)) {
              fs.unlinkSync(thumbnailPath)
              console.log('Thumbnail eliminado:', thumbnailPath)
            }
          }
        } catch (fileError) {
          console.error('Error al eliminar archivo:', fileError)
          // Continuar con la eliminación de la base de datos aunque falle la eliminación del archivo
        }
      }

      // Eliminar de la base de datos
      dbManager.deleteTrack(id)
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
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

  // Nuevo: Agregar descarga a la cola (descargas paralelas)
  ipcMain.handle('download:queue', async (_, url, format, title, thumbnail) => {
    try {
      const settings = loadSettings()
      const outputPath = settings.downloadPath || app.getPath('music')
      const downloadId = downloadService.generateDownloadId()
      
      downloadService.queueDownload({
        id: downloadId,
        url,
        outputPath,
        format,
        title,
        thumbnail,
        onProgress: async (progress) => {
          mainWindow?.webContents.send('download:progress', progress)
          
          // Cuando completa, escanear la carpeta y buscar metadata + cover
          if (progress.status === 'completed') {
            try {
              // Escanear para agregar el track a la base de datos
              await musicScanner.scanFolder(outputPath)
              
              console.log(`[Download] Archivo descargado: ${progress.filePath}`)
              
              // Buscar el track recién agregado por su ruta exacta
              let recentTrack = progress.filePath 
                ? dbManager.getTrackByFilePath(progress.filePath)
                : null
              
              // Si no lo encontramos por ruta, buscar por título
              if (!recentTrack && title) {
                const tracks = dbManager.getAllTracks()
                // Limpiar título para comparación
                let searchTitle = title
                  .replace(/\(Official.*?\)/gi, '')
                  .replace(/\(Visualizer\)/gi, '')
                  .replace(/\(Video.*?\)/gi, '')
                  .replace(/\(Lyric.*?\)/gi, '')
                  .replace(/\[.*?\]/g, '')
                  .trim()
                
                // Extraer artista del título si tiene formato "Artista - Titulo"
                let artist = ''
                if (searchTitle.includes(' - ')) {
                  const parts = searchTitle.split(' - ')
                  artist = parts[0].trim().toLowerCase()
                  searchTitle = parts.slice(1).join(' - ').trim()
                }
                
                recentTrack = tracks.find(t => {
                  const titleMatch = t.title.toLowerCase().includes(searchTitle.toLowerCase()) ||
                                     searchTitle.toLowerCase().includes(t.title.toLowerCase())
                  const artistMatch = !artist || t.artist.toLowerCase().includes(artist) ||
                                      artist.includes(t.artist.toLowerCase())
                  return titleMatch && artistMatch
                })
              }
              
              if (recentTrack && recentTrack.id) {
                console.log(`[Download] Track encontrado en DB: ${recentTrack.artist} - ${recentTrack.title}`)
                
                // Buscar metadata en MusicBrainz
                console.log(`[Download] Buscando metadata en MusicBrainz...`)
                const metadata = await musicBrainzService.searchRecording(
                  recentTrack.artist, 
                  recentTrack.title
                )
                
                if (metadata) {
                  console.log(`[Download] Metadata encontrada: ${metadata.artist} - ${metadata.title} (${metadata.album})`)
                  
                  // Actualizar metadata
                  dbManager.updateTrackMetadata(recentTrack.id, {
                    title: metadata.title || recentTrack.title,
                    artist: metadata.artist || recentTrack.artist,
                    album: metadata.album || recentTrack.album,
                    year: metadata.year,
                  })
                  console.log(`[Download] Metadata actualizada para track ID: ${recentTrack.id}`)
                  
                  // Intentar descargar cover art desde Cover Art Archive
                  console.log(`[Download] Buscando cover art en Cover Art Archive...`)
                  const coverPath = await musicBrainzService.searchAndDownloadCover(
                    metadata.artist, 
                    metadata.title, 
                    outputPath
                  )
                  if (coverPath) {
                    dbManager.updateTrackCoverArt(recentTrack.id, coverPath)
                    console.log(`[Download] Cover art descargado: ${coverPath}`)
                  } else {
                    console.log(`[Download] No se encontró cover art en Cover Art Archive`)
                  }
                } else {
                  console.log(`[Download] No se encontró metadata en MusicBrainz para: ${recentTrack.artist} - ${recentTrack.title}`)
                }
              } else {
                console.log(`[Download] No se pudo encontrar el track en la base de datos`)
              }
              
              // Notificar al frontend que la biblioteca se actualizó
              mainWindow?.webContents.send('library:updated')
              console.log(`[Download] Notificación enviada al frontend: library:updated`)
            } catch (err) {
              console.error('Error scanning/updating metadata after download:', err)
              // Aún así notificar que hubo cambios (el track se agregó al menos)
              mainWindow?.webContents.send('library:updated')
            }
          }
        }
      })
      
      return { success: true, downloadId }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  // Cancelar una descarga
  ipcMain.handle('download:cancel', async (_, downloadId) => {
    const cancelled = downloadService.cancelDownload(downloadId)
    return { success: cancelled }
  })

  // Método legacy para compatibilidad
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

  // APIs de imágenes anime
  const ANIME_APIS = [
    // 'https://api.waifu.pics/sfw/waifu',
    // 'https://api.waifu.pics/sfw/dance',
    // 'https://api.waifu.pics/sfw/neko',
    // 'https://api.waifu.pics/sfw/shinobu',
    // 'https://api.waifu.pics/sfw/megumin',
    'https://api.waifu.pics/sfw/kill',
    // 'https://api.waifu.pics/sfw/smile',
  ]

  // Obtener imagen de anime aleatoria
  ipcMain.handle('anime:getRandomImage', async () => {
    try {
      const randomApi = ANIME_APIS[Math.floor(Math.random() * ANIME_APIS.length)]
      const response = await fetch(randomApi)
      const data = await response.json()
      return { success: true, url: data.url }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  // Obtener múltiples imágenes de anime
  ipcMain.handle('anime:getMultipleImages', async (_, count: number) => {
    try {
      const images: string[] = []
      for (let i = 0; i < count; i++) {
        const randomApi = ANIME_APIS[Math.floor(Math.random() * ANIME_APIS.length)]
        const response = await fetch(randomApi)
        const data = await response.json()
        if (data.url) {
          images.push(data.url)
        }
      }
      return { success: true, images }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  // Limpiar covers corruptos y buscar nuevos desde Cover Art Archive
  ipcMain.handle('library:fixCovers', async () => {
    try {
      const tracks = dbManager.getAllTracks()
      let fixed = 0
      let failed = 0
      let skipped = 0

      for (const track of tracks) {
        if (!track.id) continue

        // Si ya tiene una ruta de archivo válida (no base64, no http), saltar
        if (track.coverArt && 
            !track.coverArt.startsWith('data:') && 
            !track.coverArt.startsWith('http') &&
            fs.existsSync(track.coverArt)) {
          console.log(`[FixCovers] Cover ya es archivo válido: ${track.coverArt}`)
          skipped++
          continue
        }

        console.log(`[FixCovers] Buscando cover para: ${track.artist} - ${track.title}`)
        console.log(`[FixCovers] Archivo de audio: ${track.filePath}`)
        
        const audioDir = path.dirname(track.filePath)
        const audioName = path.basename(track.filePath, path.extname(track.filePath))
        const possibleCovers = ['.jpg', '.jpeg', '.png', '.webp']
        
        let foundCover = false

        // Prioridad 1: Buscar en Cover Art Archive (mejor calidad)
        console.log(`[FixCovers] Buscando en Cover Art Archive...`)
        const coverFromArchive = await musicBrainzService.searchAndDownloadCover(
          track.artist,
          track.title,
          audioDir
        )
        
        if (coverFromArchive) {
          dbManager.updateTrackCoverArt(track.id, coverFromArchive)
          console.log(`[FixCovers] ✅ Cover descargado de Cover Art Archive: ${coverFromArchive}`)
          fixed++
          foundCover = true
          // Pequeña pausa para no saturar la API
          await new Promise(resolve => setTimeout(resolve, 1000))
        }

        // Prioridad 2: Buscar archivo local con el mismo nombre que el audio
        if (!foundCover) {
          console.log(`[FixCovers] Buscando cover local en: ${audioDir}`)
          
          for (const ext of possibleCovers) {
            const coverPath = path.join(audioDir, audioName + ext)
            if (fs.existsSync(coverPath)) {
              dbManager.updateTrackCoverArt(track.id, coverPath)
              console.log(`[FixCovers] ✅ Encontrado cover local: ${coverPath}`)
              fixed++
              foundCover = true
              break
            }
          }
        }

        // Prioridad 3: Buscar cualquier imagen en el directorio que contenga parte del título/artista
        if (!foundCover) {
          try {
            const files = fs.readdirSync(audioDir)
            const titleLower = track.title.toLowerCase()
            const artistLower = track.artist.toLowerCase()
            
            for (const file of files) {
              const fileLower = file.toLowerCase()
              const isImage = possibleCovers.some(ext => fileLower.endsWith(ext))
              
              if (isImage && (fileLower.includes(titleLower.substring(0, 10)) || 
                              fileLower.includes(artistLower.substring(0, 5)))) {
                const coverPath = path.join(audioDir, file)
                dbManager.updateTrackCoverArt(track.id, coverPath)
                console.log(`[FixCovers] ✅ Encontrado cover por búsqueda parcial: ${coverPath}`)
                fixed++
                foundCover = true
                break
              }
            }
          } catch (err) {
            console.error(`[FixCovers] Error listando directorio: ${err}`)
          }
        }

        // Prioridad 4: Extraer cover embebido del archivo de audio
        if (!foundCover && fs.existsSync(track.filePath)) {
          try {
            console.log(`[FixCovers] Intentando extraer cover embebido del audio...`)
            const metadata = await parseFile(track.filePath)
            
            if (metadata.common.picture && metadata.common.picture.length > 0) {
              const picture = metadata.common.picture[0]
              
              // Guardar el cover como archivo
              const ext = picture.format.includes('png') ? '.png' : '.jpg'
              const coverPath = path.join(audioDir, `${audioName}_cover${ext}`)
              
              fs.writeFileSync(coverPath, picture.data)
              dbManager.updateTrackCoverArt(track.id, coverPath)
              console.log(`[FixCovers] ✅ Cover extraído y guardado: ${coverPath}`)
              fixed++
              foundCover = true
            }
          } catch (err) {
            console.error(`[FixCovers] Error extrayendo cover embebido: ${err}`)
          }
        }

        if (!foundCover) {
          console.log(`[FixCovers] ❌ No se encontró cover para: ${track.title}`)
          failed++
        }
      }

      console.log(`[FixCovers] Completado: ${fixed} arreglados, ${failed} fallidos, ${skipped} ya correctos`)
      return { success: true, fixed, failed, total: tracks.length }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
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
