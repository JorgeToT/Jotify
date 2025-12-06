import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs/promises'
import { app } from 'electron'

export interface DownloadProgress {
  status: 'downloading' | 'converting' | 'completed' | 'error'
  progress: number
  totalSize?: string
  downloadSpeed?: string
  eta?: string
  title?: string
  artist?: string
  error?: string
}

export interface DownloadOptions {
  url: string
  outputPath: string
  format?: 'best' | 'flac' | 'opus' | 'm4a'
  extractAudio: boolean
  onProgress?: (progress: DownloadProgress) => void
}

export class DownloadService {
  private ytDlpPath: string
  private ffmpegPath: string

  constructor() {
    // Paths will be set based on platform and bundled binaries
    this.ytDlpPath = 'yt-dlp' // Will use system installation or bundled
    this.ffmpegPath = 'ffmpeg' // Will use system installation or bundled
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
            results.push({
              id: info.id,
              title: info.title,
              channel: info.channel || info.uploader,
              duration: info.duration,
              thumbnail: info.thumbnail,
              url: `https://www.youtube.com/watch?v=${info.id}`,
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
   * Descargar música en la mejor calidad posible
   * 
   * Nota sobre formatos:
   * - YouTube NO ofrece FLAC nativo
   * - La mejor calidad disponible es OPUS (hasta 160kbps) o M4A (hasta 256kbps)
   * - Podemos convertir a FLAC, pero no mejora la calidad original
   * - Mejor opción: descargar OPUS/M4A en máxima calidad y dejar como está
   */
  async downloadTrack(options: DownloadOptions): Promise<string> {
    const { url, outputPath, format = 'best', extractAudio, onProgress } = options

    return new Promise((resolve, reject) => {
      const args: string[] = []

      // Extract audio only
      if (extractAudio) {
        args.push('-x') // Extract audio
      }

      // Use cookies and more options to avoid throttling
      args.push('--no-check-certificates')
      args.push('--prefer-free-formats')
      args.push('--extractor-retries', '5')
      args.push('--fragment-retries', '10')

      // Format selection based on quality preference
      switch (format) {
        case 'opus':
          // OPUS is YouTube's highest quality format (160kbps VBR)
          args.push('-f', 'bestaudio[ext=webm]/bestaudio')
          args.push('--audio-format', 'opus')
          break
        case 'm4a':
          // M4A/AAC (up to 256kbps)
          args.push('-f', 'bestaudio[ext=m4a]/bestaudio')
          args.push('--audio-format', 'm4a')
          break
        case 'flac':
          // Convert to FLAC (no quality improvement, just lossless container)
          args.push('-f', 'bestaudio')
          args.push('--audio-format', 'flac')
          args.push('--audio-quality', '0') // Best quality
          break
        case 'best':
        default:
          // Best available audio quality
          args.push('-f', 'bestaudio/best')
          break
      }

      // Metadata embedding
      args.push('--embed-metadata')
      args.push('--embed-thumbnail')
      args.push('--convert-thumbnails', 'jpg')

      // Output template
      args.push('-o', path.join(outputPath, '%(artist)s - %(title)s.%(ext)s'))

      // Progress reporting
      args.push('--newline')
      args.push('--no-playlist')

      // URL
      args.push(url)

      const ytdlp = spawn(this.ytDlpPath, args, {
        cwd: outputPath,
      })

      let currentProgress: DownloadProgress = {
        status: 'downloading',
        progress: 0,
      }

      ytdlp.stdout.on('data', (data) => {
        const output = data.toString()

        // Parse progress information
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

        // Converting status
        if (output.includes('[ffmpeg]')) {
          currentProgress.status = 'converting'
          currentProgress.progress = 95
        }

        if (onProgress) {
          onProgress({ ...currentProgress })
        }
      })

      ytdlp.stderr.on('data', (data) => {
        console.error('yt-dlp stderr:', data.toString())
      })

      ytdlp.on('close', (code) => {
        if (code === 0) {
          currentProgress.status = 'completed'
          currentProgress.progress = 100
          if (onProgress) {
            onProgress({ ...currentProgress })
          }
          resolve(outputPath)
        } else {
          const error = `Download failed with code ${code}`
          currentProgress.status = 'error'
          currentProgress.error = error
          if (onProgress) {
            onProgress({ ...currentProgress })
          }
          reject(new Error(error))
        }
      })

      ytdlp.on('error', (error) => {
        currentProgress.status = 'error'
        currentProgress.error = error.message
        if (onProgress) {
          onProgress({ ...currentProgress })
        }
        reject(error)
      })
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
