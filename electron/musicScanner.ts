import fs from 'fs/promises'
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

  private async scanRecursive(folderPath: string, tracks: Track[]): Promise<void> {
    try {
      const entries = await fs.readdir(folderPath, { withFileTypes: true })

      for (const entry of entries) {
        // Skip system folders and recycle bin
        if (entry.name.startsWith('$') || entry.name === 'System Volume Information') {
          continue
        }

        const fullPath = path.join(folderPath, entry.name)

        if (entry.isDirectory()) {
          await this.scanRecursive(fullPath, tracks)
        } else if (entry.isFile() && this.isSupportedAudioFile(entry.name)) {
          // Skip if already in database
          if (this.dbManager.trackExists(fullPath)) {
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
    // Primarily FLAC, but also support other lossless formats
    return ['.flac', '.wav', '.ape', '.alac', '.m4a', '.aiff'].includes(ext)
  }

  private async extractMetadata(filePath: string): Promise<Track | null> {
    try {
      const metadata = await parseFile(filePath)
      const { common, format } = metadata

      // Extract cover art as base64 if available
      let coverArt: string | undefined
      if (common.picture && common.picture.length > 0) {
        const picture = common.picture[0]
        coverArt = `data:${picture.format};base64,${picture.data.toString('base64')}`
      }

      const track: Track = {
        title: common.title || path.basename(filePath, path.extname(filePath)),
        artist: common.artist || 'Unknown Artist',
        album: common.album || 'Unknown Album',
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
