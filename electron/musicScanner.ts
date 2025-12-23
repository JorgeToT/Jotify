import fsPromises from 'fs/promises'
import fs from 'fs'
import path from 'path'
import { parseFile } from 'music-metadata'
import { DatabaseManager, Track } from './database'

export class MusicScanner {
  private dbManager: DatabaseManager

  constructor(dbManager: DatabaseManager) {
    this.dbManager = dbManager
  }

  async scanFolder(folderPath: string): Promise<Track[]> {
    const tracks: Track[] = []
    await this.scanRecursive(folderPath, tracks)
    return tracks
  }

  /**
   * Extraer solo el cover art de un archivo de audio
   * Útil para re-escanear covers de tracks existentes
   */
  async extractCoverArt(filePath: string): Promise<string | null> {
    try {
      console.log(`[MusicScanner] Extrayendo cover art de: ${filePath}`)
      const metadata = await parseFile(filePath)
      const { common } = metadata

      // Intentar extraer del archivo embebido
      if (common.picture && common.picture.length > 0) {
        const picture = common.picture[0]
        const coverArt = `data:${picture.format};base64,${picture.data.toString('base64')}`
        console.log(`[MusicScanner] Cover art embebido encontrado`)
        return coverArt
      }

      // Buscar archivo de thumbnail externo
      const thumbnailPath = await this.findThumbnailFile(filePath)
      if (thumbnailPath) {
        try {
          const thumbnailData = await fsPromises.readFile(thumbnailPath)
          const ext = path.extname(thumbnailPath).toLowerCase()
          const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg'
          const coverArt = `data:${mimeType};base64,${thumbnailData.toString('base64')}`
          console.log(`[MusicScanner] Thumbnail externo encontrado: ${thumbnailPath}`)
          return coverArt
        } catch (err) {
          console.error(`[MusicScanner] Error leyendo thumbnail: ${err}`)
        }
      }

      // Fallback a imagen de música
      const fallback = this.getRandomAnimeFallback()
      console.log(`[MusicScanner] Usando fallback: ${fallback}`)
      return fallback
    } catch (error) {
      console.error(`[MusicScanner] Error extrayendo cover de ${filePath}:`, error)
      return this.getRandomAnimeFallback()
    }
  }

  private async scanRecursive(folderPath: string, tracks: Track[]): Promise<void> {
    try {
      const entries = await fsPromises.readdir(folderPath, { withFileTypes: true })

      for (const entry of entries) {
        // Skip system folders and recycle bin
        if (entry.name.startsWith('$') || entry.name === 'System Volume Information') {
          continue
        }

        const fullPath = path.join(folderPath, entry.name)

        if (entry.isDirectory()) {
          await this.scanRecursive(fullPath, tracks)
        } else if (entry.isFile() && this.isSupportedAudioFile(entry.name)) {
          // Check if already in database
          const existingTrack = this.dbManager.getTrackByFilePath(fullPath)
          
          if (existingTrack) {
            // Si existe pero no tiene cover art válido, actualizar
            // Considerar válido: base64, URL http, o ruta de archivo local existente
            const hasValidCover = existingTrack.coverArt && (
              existingTrack.coverArt.startsWith('data:image/') ||
              existingTrack.coverArt.startsWith('http') ||
              (existingTrack.coverArt.includes(':\\') && fs.existsSync(existingTrack.coverArt)) ||
              (existingTrack.coverArt.startsWith('/') && fs.existsSync(existingTrack.coverArt))
            )
            
            if (!hasValidCover) {
              console.log(`[MusicScanner] Actualizando cover art para: ${existingTrack.title}`)
              try {
                const newCoverArt = await this.extractCoverArt(fullPath)
                if (newCoverArt && existingTrack.id) {
                  this.dbManager.updateTrackCoverArt(existingTrack.id, newCoverArt)
                  tracks.push({ ...existingTrack, coverArt: newCoverArt })
                }
              } catch (err) {
                console.error(`[MusicScanner] Error actualizando cover: ${err}`)
              }
            }
            continue
          }

          try {
            const track = await this.extractMetadata(fullPath)
            if (track) {
              const trackId = this.dbManager.insertTrack(track)
              tracks.push({ ...track, id: trackId })
            }
          } catch (error) {
            console.error(`Error processing ${fullPath}:`, error)
          }
        }
      }
    } catch (error) {
      console.error(`Error scanning ${folderPath}:`, error)
    }
  }

  private isSupportedAudioFile(filename: string): boolean {
    const ext = path.extname(filename).toLowerCase()
    // Soportar FLAC, formatos lossless y formatos de YouTube (opus, ogg, webm)
    return ['.flac', '.wav', '.ape', '.alac', '.m4a', '.aiff', '.opus', '.ogg', '.webm', '.mp3'].includes(ext)
  }

  // URLs de imágenes de anime para usar como fallback (música/auriculares theme)
  private animeFallbackImages: string[] = [
    'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=400&fit=crop', // Music concert
    'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&h=400&fit=crop', // Headphones
    'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=400&h=400&fit=crop', // Vinyl
    'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&h=400&fit=crop', // DJ
    'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=400&h=400&fit=crop', // Concert lights
    'https://images.unsplash.com/photo-1504898770365-14faca6a7320?w=400&h=400&fit=crop', // Music notes
  ]

  private getRandomAnimeFallback(): string {
    const randomIndex = Math.floor(Math.random() * this.animeFallbackImages.length)
    return this.animeFallbackImages[randomIndex]
  }

  /**
   * Limpiar el título removiendo texto común de YouTube
   * Ejemplos: "Artist - Song (Official Video)" -> "Song"
   */
  private cleanTitle(filename: string): string {
    let title = filename

    // Patrones comunes en títulos de YouTube a remover
    const patternsToRemove = [
      /\s*\(Official\s*(Music\s*)?Video\)/gi,
      /\s*\(Official\s*Audio\)/gi,
      /\s*\(Lyric\s*Video\)/gi,
      /\s*\(Lyrics?\)/gi,
      /\s*\(Visualizer\)/gi,
      /\s*\(Audio\s*Oficial\)/gi,
      /\s*\(Video\s*Oficial\)/gi,
      /\s*\(Videoclip\s*Oficial\)/gi,
      /\s*\[Official\s*(Music\s*)?Video\]/gi,
      /\s*\[Official\s*Audio\]/gi,
      /\s*\|.*$/gi, // Remover todo después de |
      /\s*ft\.?\s+.*/gi, // Remover featuring (opcional)
      /\s*feat\.?\s+.*/gi,
    ]

    for (const pattern of patternsToRemove) {
      title = title.replace(pattern, '')
    }

    // Si el título tiene formato "Artista - Canción", extraer solo la canción
    if (title.includes(' - ')) {
      const parts = title.split(' - ')
      if (parts.length >= 2) {
        title = parts.slice(1).join(' - ').trim()
      }
    }

    return title.trim() || filename
  }

  /**
   * Extraer el artista del nombre del archivo
   * Ejemplos: "Artist - Song (Official Video)" -> "Artist"
   */
  private extractArtistFromFilename(filename: string): string {
    // Si el título tiene formato "Artista - Canción", extraer el artista
    if (filename.includes(' - ')) {
      const parts = filename.split(' - ')
      if (parts.length >= 2) {
        return parts[0].trim()
      }
    }

    return 'Artista Desconocido'
  }

  /**
   * Buscar archivo de thumbnail junto al archivo de audio
   * yt-dlp guarda los thumbnails con el mismo nombre pero extensión .jpg/.webp/.png
   */
  private async findThumbnailFile(audioFilePath: string): Promise<string | null> {
    const dir = path.dirname(audioFilePath)
    const baseName = path.basename(audioFilePath, path.extname(audioFilePath))
    
    // Posibles extensiones de thumbnail que yt-dlp puede generar
    const thumbnailExtensions = ['.jpg', '.jpeg', '.png', '.webp']
    
    for (const ext of thumbnailExtensions) {
      const thumbnailPath = path.join(dir, baseName + ext)
      try {
        await fsPromises.access(thumbnailPath)
        console.log(`[MusicScanner] Archivo de thumbnail encontrado: ${thumbnailPath}`)
        return thumbnailPath
      } catch {
        // El archivo no existe, continuar buscando
      }
    }
    
    console.log(`[MusicScanner] No se encontró archivo de thumbnail para: ${baseName}`)
    return null
  }

  private async extractMetadata(filePath: string): Promise<Track | null> {
    try {
      console.log(`[MusicScanner] Extrayendo metadata de: ${filePath}`)
      const metadata = await parseFile(filePath)
      const { common, format } = metadata

      // Extract cover art as base64 if available
      let coverArt: string | undefined
      if (common.picture && common.picture.length > 0) {
        const picture = common.picture[0]
        coverArt = `data:${picture.format};base64,${picture.data.toString('base64')}`
        console.log(`[MusicScanner] Cover art encontrado embebido en el archivo`)
        console.log(`[MusicScanner] Cover art size: ${coverArt.length} caracteres, formato: ${picture.format}`)
      } else {
        console.log(`[MusicScanner] No hay cover art embebido, buscando archivo de thumbnail...`)
        // Buscar thumbnail como archivo separado (yt-dlp lo guarda así)
        const thumbnailPath = await this.findThumbnailFile(filePath)
        if (thumbnailPath) {
          // Guardar la ruta del archivo en lugar de convertir a base64
          // Esto es más eficiente y evita problemas con base64 grandes
          coverArt = thumbnailPath
          console.log(`[MusicScanner] Thumbnail encontrado, guardando ruta: ${thumbnailPath}`)
        }
        
        // Si aún no hay cover art, usar fallback de anime
        if (!coverArt) {
          coverArt = this.getRandomAnimeFallback()
          console.log(`[MusicScanner] Usando imagen de anime como fallback: ${coverArt}`)
        }
      }

      const track: Track = {
        title: common.title || this.cleanTitle(path.basename(filePath, path.extname(filePath))),
        artist: common.artist || this.extractArtistFromFilename(path.basename(filePath, path.extname(filePath))),
        album: common.album || 'Descargas',
        albumArtist: common.albumartist,
        year: common.year,
        genre: common.genre ? common.genre[0] : undefined,
        duration: format.duration || 0,
        filePath,
        trackNumber: common.track.no || undefined,
        diskNumber: common.disk.no || undefined,
        bitrate: format.bitrate,
        sampleRate: format.sampleRate,
        bitsPerSample: format.bitsPerSample,
        coverArt,
        dateAdded: new Date().toISOString(),
      }

      return track
    } catch (error) {
      console.error(`Failed to extract metadata from ${filePath}:`, error)
      return null
    }
  }
}
