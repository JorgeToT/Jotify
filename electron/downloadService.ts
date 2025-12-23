import { spawn, ChildProcess } from 'child_process'
import path from 'path'
import fs from 'fs/promises'
import fsSync from 'fs'
import { app } from 'electron'
import https from 'https'
import http from 'http'

export interface DownloadProgress {
  id: string
  status: 'queued' | 'downloading' | 'converting' | 'completed' | 'error'
  progress: number
  totalSize?: string
  downloadSpeed?: string
  eta?: string
  title?: string
  thumbnail?: string
  url?: string
  error?: string
  filePath?: string  // Ruta del archivo descargado
}

export interface DownloadOptions {
  url: string
  outputPath: string
  format?: 'best' | 'flac' | 'opus' | 'm4a'
  extractAudio: boolean
  onProgress?: (progress: DownloadProgress) => void
}

export interface DownloadQueueItem {
  id: string
  url: string
  outputPath: string
  format: 'best' | 'flac' | 'opus' | 'm4a'
  title?: string
  thumbnail?: string
  onProgress?: (progress: DownloadProgress) => void
}

export class DownloadService {
  private ytDlpPath: string
  private ffmpegPath: string
  private activeDownloads: Map<string, ChildProcess> = new Map()
  private downloadQueue: DownloadQueueItem[] = []
  private maxConcurrentDownloads: number = 3
  private runningDownloads: number = 0

  constructor() {
    // Paths will be set based on platform and bundled binaries
    this.ytDlpPath = 'yt-dlp' // Will use system installation or bundled
    this.ffmpegPath = 'ffmpeg' // Will use system installation or bundled
  }

  /**
   * Generar un ID único para cada descarga
   */
  generateDownloadId(): string {
    return `dl_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  /**
   * Remover silencios al inicio y final de un archivo de audio
   */
  private async removeSilence(filePath: string): Promise<string> {
    return new Promise(async (resolve) => {
      // Verificar que el archivo existe
      if (!fsSync.existsSync(filePath)) {
        console.log(`[DownloadService] Archivo no encontrado para remover silencios: ${filePath}`)
        // Intentar buscar el archivo por patrón en el directorio
        const dir = path.dirname(filePath)
        const baseName = path.basename(filePath, path.extname(filePath))
        
        try {
          const files = fsSync.readdirSync(dir)
          // Buscar un archivo que contenga parte del nombre
          const searchTerms = baseName.substring(0, 20).toLowerCase()
          const foundFile = files.find(f => 
            f.toLowerCase().includes(searchTerms) && 
            (f.endsWith('.m4a') || f.endsWith('.opus') || f.endsWith('.flac') || f.endsWith('.mp3'))
          )
          
          if (foundFile) {
            filePath = path.join(dir, foundFile)
            console.log(`[DownloadService] Archivo encontrado por búsqueda: ${filePath}`)
          } else {
            console.log(`[DownloadService] No se encontró archivo para procesar`)
            resolve(filePath)
            return
          }
        } catch (err) {
          console.error(`[DownloadService] Error buscando archivo:`, err)
          resolve(filePath)
          return
        }
      }

      // Crear archivo temporal para el output
      const ext = path.extname(filePath)
      const dir = path.dirname(filePath)
      const baseName = path.basename(filePath, ext)
      const tempOutput = path.join(dir, `${baseName}_trimmed${ext}`)

      console.log(`[DownloadService] Removiendo silencios de: ${filePath}`)

      // Usar ffmpeg para remover silencios
      const args = [
        '-i', filePath,
        '-af', 'silenceremove=start_periods=1:start_duration=0.1:start_threshold=-50dB:stop_periods=-1:stop_duration=0.5:stop_threshold=-50dB',
        '-c:a', 'aac',
        '-b:a', '256k',
        '-y',
        tempOutput
      ]

      console.log(`[DownloadService] ffmpeg args: ffmpeg ${args.join(' ')}`)

      const ffmpeg = spawn(this.ffmpegPath, args, {
        windowsHide: true,
        shell: false
      })

      let stderrOutput = ''
      
      ffmpeg.stderr.on('data', (data) => {
        stderrOutput += data.toString()
      })

      ffmpeg.on('close', async (code) => {
        if (code === 0) {
          try {
            await fs.unlink(filePath)
            await fs.rename(tempOutput, filePath)
            console.log(`[DownloadService] ✅ Silencios removidos exitosamente`)
            resolve(filePath)
          } catch (err) {
            console.error(`[DownloadService] Error reemplazando archivo: ${err}`)
            try { await fs.unlink(tempOutput) } catch {}
            resolve(filePath)
          }
        } else {
          console.error(`[DownloadService] ❌ Error removiendo silencios (code ${code}):`, stderrOutput.slice(-500))
          try { await fs.unlink(tempOutput) } catch {}
          resolve(filePath)
        }
      })

      ffmpeg.on('error', (error) => {
        console.error(`[DownloadService] Error ejecutando ffmpeg:`, error)
        resolve(filePath)
      })
    })
  }

  /**
   * Obtener el número de descargas activas
   */
  getActiveDownloadsCount(): number {
    return this.runningDownloads
  }

  /**
   * Cancelar una descarga por ID
   */
  cancelDownload(downloadId: string): boolean {
    const process = this.activeDownloads.get(downloadId)
    if (process) {
      process.kill('SIGTERM')
      this.activeDownloads.delete(downloadId)
      this.runningDownloads--
      this.processQueue()
      return true
    }
    // También buscar en la cola
    const queueIndex = this.downloadQueue.findIndex(item => item.id === downloadId)
    if (queueIndex !== -1) {
      this.downloadQueue.splice(queueIndex, 1)
      return true
    }
    return false
  }

  /**
   * Actualizar yt-dlp a la última versión
   */
  async updateYtDlp(): Promise<{ success: boolean; message: string }> {
    return new Promise((resolve) => {
      const ytdlp = spawn(this.ytDlpPath, ['-U'])

      let output = ''

      ytdlp.stdout.on('data', (data) => {
        output += data.toString()
      })

      ytdlp.stderr.on('data', (data) => {
        output += data.toString()
      })

      ytdlp.on('close', (code) => {
        if (code === 0 || output.includes('up to date') || output.includes('Updated')) {
          resolve({ success: true, message: 'yt-dlp actualizado correctamente' })
        } else {
          resolve({ success: false, message: 'Error al actualizar. Intenta manualmente: yt-dlp -U' })
        }
      })

      ytdlp.on('error', () => {
        resolve({ success: false, message: 'yt-dlp no está instalado o no se encuentra en PATH' })
      })
    })
  }

  /**
   * Buscar música en YouTube/YouTube Music
   */
  async searchMusic(query: string, limit = 10): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const args = [
        '--dump-json',
        '--flat-playlist',
        '--skip-download',
        `ytsearch${limit}:${query}`,
      ]

      const results: any[] = []
      const ytdlp = spawn(this.ytDlpPath, args)

      let outputData = ''

      ytdlp.stdout.on('data', (data) => {
        outputData += data.toString()
      })

      ytdlp.on('close', (code) => {
        if (code !== 0) {
          reject(new Error('Search failed'))
          return
        }

        const lines = outputData.trim().split('\n')
        lines.forEach((line) => {
          try {
            const info = JSON.parse(line)
            const videoId = info.id
            // Siempre construir URL de thumbnail válida basada en el ID del video
            // YouTube provee múltiples opciones: hqdefault (480x360), mqdefault (320x180), sddefault, maxresdefault
            const thumbnail = info.thumbnail && info.thumbnail.startsWith('https://') 
              ? info.thumbnail 
              : `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
            
            results.push({
              id: videoId,
              title: info.title,
              channel: info.channel || info.uploader,
              duration: info.duration,
              thumbnail: thumbnail,
              url: `https://www.youtube.com/watch?v=${videoId}`,
            })
          } catch (e) {
            // Skip invalid lines
          }
        })

        resolve(results)
      })

      ytdlp.on('error', reject)
    })
  }

  /**
   * Agregar una descarga a la cola
   */
  queueDownload(item: DownloadQueueItem): void {
    this.downloadQueue.push(item)
    
    // Notificar que está en cola
    if (item.onProgress) {
      item.onProgress({
        id: item.id,
        status: 'queued',
        progress: 0,
        title: item.title,
        thumbnail: item.thumbnail,
        url: item.url,
      })
    }
    
    this.processQueue()
  }

  /**
   * Procesar la cola de descargas
   */
  private processQueue(): void {
    while (this.runningDownloads < this.maxConcurrentDownloads && this.downloadQueue.length > 0) {
      const item = this.downloadQueue.shift()
      if (item) {
        this.runningDownloads++
        this.executeDownload(item)
      }
    }
  }

  /**
   * Ejecutar una descarga individual
   */
  private async executeDownload(item: DownloadQueueItem): Promise<void> {
    const { id, url, outputPath, format, title, thumbnail, onProgress } = item

    // Crear subcarpeta "canciones" para organizar mejor
    const songsPath = path.join(outputPath, 'canciones')
    if (!fsSync.existsSync(songsPath)) {
      fsSync.mkdirSync(songsPath, { recursive: true })
    }

    const args: string[] = []

    // Extract audio only
    args.push('-x')

    // Use cookies and more options to avoid throttling
    args.push('--no-check-certificates')
    args.push('--prefer-free-formats')
    args.push('--extractor-retries', '5')
    args.push('--fragment-retries', '10')

    // Format selection based on quality preference
    switch (format) {
      case 'opus':
        args.push('-f', 'bestaudio[ext=webm]/bestaudio')
        args.push('--audio-format', 'opus')
        break
      case 'm4a':
        args.push('-f', 'bestaudio[ext=m4a]/bestaudio')
        args.push('--audio-format', 'm4a')
        break
      case 'flac':
        args.push('-f', 'bestaudio')
        args.push('--audio-format', 'flac')
        args.push('--audio-quality', '0')
        break
      case 'best':
      default:
        args.push('-f', 'bestaudio/best')
        break
    }

    // Metadata embedding
    args.push('--embed-metadata')
    
    // No escribir thumbnail separado - usaremos Cover Art Archive para mejor calidad
    // El thumbnail se embebe en el archivo si el formato lo soporta
    if (format === 'm4a' || format === 'flac') {
      args.push('--embed-thumbnail')
      args.push('--convert-thumbnails', 'jpg')
    }

    // Output template - guardar canciones en subcarpeta "canciones"
    args.push('-o', path.join(songsPath, '%(title)s.%(ext)s'))

    // Progress reporting
    args.push('--newline')
    args.push('--no-playlist')

    // URL
    args.push(url)

    console.log(`[DownloadService] Iniciando descarga: ${title || url}`)
    console.log(`[DownloadService] Formato: ${format}`)
    console.log(`[DownloadService] Output path (canciones): ${songsPath}`)
    console.log(`[DownloadService] Args: ${args.join(' ')}`)

    const ytdlp = spawn(this.ytDlpPath, args, {
      cwd: songsPath,  // Ejecutar en la carpeta de canciones
    })

    this.activeDownloads.set(id, ytdlp)

    let currentProgress: DownloadProgress = {
      id,
      status: 'downloading',
      progress: 0,
      title,
      thumbnail,
      url,
    }

    let fullOutput = '' // Capturar todo el output para logs
    let downloadedFilePath = '' // Capturar la ruta del archivo descargado

    ytdlp.stdout.on('data', (data) => {
      const output = data.toString()
      fullOutput += output

      // Log de thumbnail
      if (output.includes('thumbnail') || output.includes('Thumbnail')) {
        console.log(`[DownloadService] Thumbnail info: ${output.trim()}`)
      }

      // Capturar el nombre del archivo cuando yt-dlp lo escribe
      // Ejemplo: [download] Destination: /path/to/Artist - Song.m4a
      const destMatch = output.match(/\[download\] Destination:\s*(.+)/)
      if (destMatch) {
        downloadedFilePath = destMatch[1].trim()
        console.log(`[DownloadService] Archivo destino detectado: ${downloadedFilePath}`)
      }
      
      // También capturar cuando ya existe: [download] /path/to/file.m4a has already been downloaded
      const alreadyMatch = output.match(/\[download\]\s+(.+\.(?:m4a|opus|flac|mp3|ogg|webm))\s+has already been downloaded/)
      if (alreadyMatch) {
        downloadedFilePath = alreadyMatch[1].trim()
        console.log(`[DownloadService] Archivo ya existente: ${downloadedFilePath}`)
      }

      // Capturar cuando ffmpeg convierte: [ffmpeg] Destination: /path/to/file.m4a
      const ffmpegDestMatch = output.match(/\[ffmpeg\] Destination:\s*(.+)/)
      if (ffmpegDestMatch) {
        downloadedFilePath = ffmpegDestMatch[1].trim()
        console.log(`[DownloadService] Archivo convertido por ffmpeg: ${downloadedFilePath}`)
      }

      const downloadMatch = output.match(/\[download\]\s+(\d+\.?\d*)%/)
      if (downloadMatch) {
        currentProgress.progress = parseFloat(downloadMatch[1])
        currentProgress.status = 'downloading'
      }

      const sizeMatch = output.match(/of\s+([\d.]+\w+)/)
      if (sizeMatch) {
        currentProgress.totalSize = sizeMatch[1]
      }

      const speedMatch = output.match(/at\s+([\d.]+\w+\/s)/)
      if (speedMatch) {
        currentProgress.downloadSpeed = speedMatch[1]
      }

      const etaMatch = output.match(/ETA\s+([\d:]+)/)
      if (etaMatch) {
        currentProgress.eta = etaMatch[1]
      }

      if (output.includes('[ffmpeg]')) {
        currentProgress.status = 'converting'
        currentProgress.progress = 95
      }

      if (onProgress) {
        onProgress({ ...currentProgress })
      }
    })

    ytdlp.stderr.on('data', (data) => {
      const stderrOutput = data.toString()
      console.error('[DownloadService] yt-dlp stderr:', stderrOutput)
      fullOutput += stderrOutput
    })

    ytdlp.on('close', async (code) => {
      this.activeDownloads.delete(id)
      this.runningDownloads--

      console.log(`[DownloadService] Descarga finalizada con código: ${code}`)
      console.log(`[DownloadService] Archivo descargado: ${downloadedFilePath}`)

      if (code === 0) {
        // Buscar el archivo recién descargado en el directorio
        // ya que el path de yt-dlp puede tener problemas de codificación
        let actualFilePath = downloadedFilePath
        
        try {
          const files = fsSync.readdirSync(songsPath)
          const audioExtensions = ['.m4a', '.opus', '.flac', '.mp3', '.ogg', '.webm']
          
          // Ordenar por fecha de modificación (más reciente primero)
          const audioFiles = files
            .filter(f => audioExtensions.some(ext => f.toLowerCase().endsWith(ext)))
            .map(f => ({
              name: f,
              path: path.join(songsPath, f),
              mtime: fsSync.statSync(path.join(songsPath, f)).mtime
            }))
            .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())
          
          if (audioFiles.length > 0) {
            // El archivo más reciente debería ser el que acabamos de descargar
            const recentFile = audioFiles[0]
            // Verificar que fue modificado en los últimos 2 minutos
            if (Date.now() - recentFile.mtime.getTime() < 120000) {
              actualFilePath = recentFile.path
              console.log(`[DownloadService] Archivo detectado por fecha: ${actualFilePath}`)
            }
          }
        } catch (err) {
          console.error(`[DownloadService] Error buscando archivo reciente:`, err)
        }

        // Remover silencios del archivo descargado
        currentProgress.status = 'converting'
        currentProgress.progress = 98
        if (onProgress) {
          onProgress({ ...currentProgress })
        }

        try {
          await this.removeSilence(actualFilePath)
        } catch (err) {
          console.error(`[DownloadService] Error en removeSilence (continuando):`, err)
        }

        currentProgress.status = 'completed'
        currentProgress.progress = 100
        currentProgress.filePath = actualFilePath
        console.log(`[DownloadService] ✅ Descarga completada exitosamente: ${title}`)
        if (onProgress) {
          onProgress({ ...currentProgress })
        }
      } else {
        currentProgress.status = 'error'
        currentProgress.error = `Download failed with code ${code}`
        console.error(`[DownloadService] ❌ Error en descarga: ${currentProgress.error}`)
        if (onProgress) {
          onProgress({ ...currentProgress })
        }
      }

      // Procesar siguiente en cola
      this.processQueue()
    })

    ytdlp.on('error', (error) => {
      this.activeDownloads.delete(id)
      this.runningDownloads--
      
      currentProgress.status = 'error'
      currentProgress.error = error.message
      if (onProgress) {
        onProgress({ ...currentProgress })
      }

      // Procesar siguiente en cola
      this.processQueue()
    })
  }

  /**
   * Descargar música en la mejor calidad posible (método legacy para compatibilidad)
   */
  async downloadTrack(options: DownloadOptions): Promise<string> {
    const { url, outputPath, format = 'best', onProgress } = options
    const id = this.generateDownloadId()

    return new Promise((resolve, reject) => {
      const item: DownloadQueueItem = {
        id,
        url,
        outputPath,
        format: format as 'best' | 'flac' | 'opus' | 'm4a',
        onProgress: (progress) => {
          if (onProgress) {
            onProgress(progress)
          }
          if (progress.status === 'completed') {
            resolve(outputPath)
          } else if (progress.status === 'error') {
            reject(new Error(progress.error || 'Download failed'))
          }
        }
      }

      this.queueDownload(item)
    })
  }

  /**
   * Get video/audio info without downloading
   */
  async getMediaInfo(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const args = ['--dump-json', '--skip-download', url]

      const ytdlp = spawn(this.ytDlpPath, args)

      let outputData = ''

      ytdlp.stdout.on('data', (data) => {
        outputData += data.toString()
      })

      ytdlp.on('close', (code) => {
        if (code !== 0) {
          reject(new Error('Failed to get media info'))
          return
        }

        try {
          const info = JSON.parse(outputData)
          resolve({
            id: info.id,
            title: info.title,
            artist: info.artist || info.uploader,
            album: info.album,
            duration: info.duration,
            thumbnail: info.thumbnail,
            formats: info.formats?.map((f: any) => ({
              formatId: f.format_id,
              ext: f.ext,
              quality: f.quality,
              filesize: f.filesize,
              acodec: f.acodec,
              abr: f.abr,
            })),
          })
        } catch (error) {
          reject(error)
        }
      })

      ytdlp.on('error', reject)
    })
  }

  /**
   * Check if yt-dlp is installed
   */
  async checkYtDlpInstalled(): Promise<boolean> {
    return new Promise((resolve) => {
      const ytdlp = spawn(this.ytDlpPath, ['--version'])
      
      ytdlp.on('close', (code) => {
        resolve(code === 0)
      })

      ytdlp.on('error', () => {
        resolve(false)
      })
    })
  }

  /**
   * Get available audio formats for a URL
   */
  async getAvailableFormats(url: string): Promise<any[]> {
    const info = await this.getMediaInfo(url)
    
    // Filter only audio formats
    const audioFormats = info.formats?.filter((f: any) => 
      f.acodec && f.acodec !== 'none' && !f.vcodec
    ) || []

    return audioFormats.sort((a: any, b: any) => (b.abr || 0) - (a.abr || 0))
  }
}
