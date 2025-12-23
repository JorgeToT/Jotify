import { MusicBrainzApi } from 'musicbrainz-api'
import https from 'https'
import http from 'http'
import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'

interface MusicBrainzRecording {
  id: string
  title: string
  artist: string
  album?: string
  year?: number
  duration?: number
}

export class MusicBrainzService {
  private mbApi: MusicBrainzApi

  constructor() {
    this.mbApi = new MusicBrainzApi({
      appName: 'Jotify',
      appVersion: '1.0.0',
      appContactInfo: 'https://github.com/JorgeToT/Jotify',
    })
  }

  /**
   * Buscar información de una canción por artista y título
   */
  async searchRecording(artist: string, title: string): Promise<MusicBrainzRecording | null> {
    try {
      // Limpiar el título para mejor búsqueda
      const cleanTitle = this.cleanSearchQuery(title)
      const cleanArtist = this.cleanSearchQuery(artist)

      console.log(`[MusicBrainz] Buscando: ${cleanArtist} - ${cleanTitle}`)

      const result = await this.mbApi.search('recording', {
        query: `recording:"${cleanTitle}" AND artist:"${cleanArtist}"`,
        limit: 5,
      })

      if (!result.recordings || result.recordings.length === 0) {
        // Intentar búsqueda más flexible
        console.log(`[MusicBrainz] Búsqueda exacta sin resultados, intentando flexible...`)
        const flexResult = await this.mbApi.search('recording', {
          query: `${cleanTitle} ${cleanArtist}`,
          limit: 5,
        })

        if (!flexResult.recordings || flexResult.recordings.length === 0) {
          console.log(`[MusicBrainz] No se encontraron resultados`)
          return null
        }

        return this.parseRecording(flexResult.recordings[0], artist)
      }

      return this.parseRecording(result.recordings[0], artist)
    } catch (error) {
      console.error('[MusicBrainz] Error en búsqueda:', error)
      return null
    }
  }

  /**
   * Parsear el resultado de MusicBrainz a nuestro formato
   */
  private parseRecording(recording: any, fallbackArtist: string): MusicBrainzRecording {
    const artistCredit = recording['artist-credit']?.[0]?.artist?.name || fallbackArtist
    const releases = recording.releases || []
    const firstRelease = releases[0]

    console.log(`[MusicBrainz] Encontrado: ${artistCredit} - ${recording.title}`)
    if (firstRelease) {
      console.log(`[MusicBrainz] Álbum: ${firstRelease.title}`)
    }

    return {
      id: recording.id,
      title: recording.title,
      artist: artistCredit,
      album: firstRelease?.title,
      year: firstRelease?.date ? parseInt(firstRelease.date.substring(0, 4)) : undefined,
      duration: recording.length ? Math.floor(recording.length / 1000) : undefined,
    }
  }

  /**
   * Buscar álbum y obtener cover art
   */
  async searchRelease(artist: string, album: string): Promise<{ id: string; title: string; coverArtUrl?: string } | null> {
    try {
      const cleanAlbum = this.cleanSearchQuery(album)
      const cleanArtist = this.cleanSearchQuery(artist)

      const result = await this.mbApi.search('release', {
        query: `release:"${cleanAlbum}" AND artist:"${cleanArtist}"`,
        limit: 1,
      })

      if (!result.releases || result.releases.length === 0) {
        return null
      }

      const release = result.releases[0]

      return {
        id: release.id,
        title: release.title,
        coverArtUrl: `https://coverartarchive.org/release/${release.id}/front-250`,
      }
    } catch (error) {
      console.error('[MusicBrainz] Error buscando release:', error)
      return null
    }
  }

  /**
   * Descargar cover art desde Cover Art Archive y guardarlo como archivo
   */
  async downloadCoverArt(releaseId: string, outputPath: string, filename: string): Promise<string | null> {
    const coverUrl = `https://coverartarchive.org/release/${releaseId}/front-250`
    
    try {
      console.log(`[MusicBrainz] Descargando cover art desde: ${coverUrl}`)
      
      // Cover Art Archive redirecciona, necesitamos seguir redirects
      const imageUrl = await this.followRedirects(coverUrl)
      if (!imageUrl) {
        console.log(`[MusicBrainz] No se pudo resolver URL de cover art`)
        return null
      }

      const imageData = await this.downloadImage(imageUrl)
      if (!imageData) {
        console.log(`[MusicBrainz] No se pudo descargar la imagen`)
        return null
      }

      // Determinar extensión
      const ext = imageUrl.includes('.png') ? '.png' : '.jpg'
      const coverPath = path.join(outputPath, `${filename}${ext}`)
      
      await fs.writeFile(coverPath, imageData)
      console.log(`[MusicBrainz] Cover art guardado en: ${coverPath}`)
      
      return coverPath
    } catch (error) {
      console.error('[MusicBrainz] Error descargando cover art:', error)
      return null
    }
  }

  /**
   * Buscar y descargar cover art para un track
   */
  async searchAndDownloadCover(artist: string, title: string, outputPath: string): Promise<string | null> {
    try {
      // Primero buscar el recording para obtener el release/album
      const recording = await this.searchRecording(artist, title)
      if (!recording || !recording.album) {
        console.log(`[MusicBrainz] No se encontró álbum para: ${artist} - ${title}`)
        return null
      }

      // Buscar el release para obtener el ID del cover
      const release = await this.searchRelease(artist, recording.album)
      if (!release) {
        console.log(`[MusicBrainz] No se encontró release para: ${recording.album}`)
        return null
      }

      // Crear carpeta "covers" si no existe
      const coversPath = path.join(outputPath, 'covers')
      if (!fsSync.existsSync(coversPath)) {
        fsSync.mkdirSync(coversPath, { recursive: true })
      }

      // Crear nombre de archivo seguro
      const safeFilename = `${artist} - ${title}`.replace(/[<>:"/\\|?*]/g, '_')
      
      // Descargar el cover en la carpeta covers
      return await this.downloadCoverArt(release.id, coversPath, safeFilename)
    } catch (error) {
      console.error('[MusicBrainz] Error en searchAndDownloadCover:', error)
      return null
    }
  }

  /**
   * Seguir redirects HTTP/HTTPS
   */
  private followRedirects(url: string, maxRedirects = 5): Promise<string | null> {
    return new Promise((resolve) => {
      if (maxRedirects <= 0) {
        resolve(null)
        return
      }

      const client = url.startsWith('https') ? https : http
      
      const request = client.get(url, (response) => {
        if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          // Seguir redirect
          resolve(this.followRedirects(response.headers.location, maxRedirects - 1))
        } else if (response.statusCode === 200) {
          resolve(url)
        } else {
          resolve(null)
        }
        response.destroy()
      })

      request.on('error', () => resolve(null))
      request.setTimeout(10000, () => {
        request.destroy()
        resolve(null)
      })
    })
  }

  /**
   * Descargar imagen desde URL
   */
  private downloadImage(url: string): Promise<Buffer | null> {
    return new Promise((resolve) => {
      const client = url.startsWith('https') ? https : http
      
      const request = client.get(url, (response) => {
        if (response.statusCode !== 200) {
          resolve(null)
          return
        }

        const chunks: Buffer[] = []
        response.on('data', (chunk) => chunks.push(chunk))
        response.on('end', () => resolve(Buffer.concat(chunks)))
        response.on('error', () => resolve(null))
      })

      request.on('error', () => resolve(null))
      request.setTimeout(30000, () => {
        request.destroy()
        resolve(null)
      })
    })
  }

  /**
   * Limpiar query de búsqueda
   */
  private cleanSearchQuery(query: string): string {
    let cleaned = query
      .replace(/\s*\(Official.*?\)/gi, '')
      .replace(/\s*\(Video.*?\)/gi, '')
      .replace(/\s*\(Audio.*?\)/gi, '')
      .replace(/\s*\(Lyric.*?\)/gi, '')
      .replace(/\s*\(Visualizer\)/gi, '')
      .replace(/\s*\(Videoclip.*?\)/gi, '')
      .replace(/\s*\[Official.*?\]/gi, '')
      .replace(/\s*\|.*$/gi, '')
      .replace(/\s*ft\.?\s+.*/gi, '')
      .replace(/\s*feat\.?\s+.*/gi, '')
      .replace(/\s*video\s*clip\s*/gi, '')
      .trim()

    return cleaned || query
  }
}
