import initSqlJs, { Database as SqlJsDatabase } from 'sql.js'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'

export interface Track {
  id?: number
  title: string
  artist: string
  album: string
  albumArtist?: string
  year?: number
  genre?: string
  duration: number
  filePath: string
  trackNumber?: number
  diskNumber?: number
  bitrate?: number
  sampleRate?: number
  bitsPerSample?: number
  coverArt?: string
  dateAdded: string
}

export interface Playlist {
  id?: number
  name: string
  description?: string
  coverArt?: string
  createdAt: string
  updatedAt: string
}

export class DatabaseManager {
  private db: SqlJsDatabase | null = null
  private dbPath: string
  private SQL: any
  private initPromise: Promise<void>

  constructor(dbPath: string) {
    this.dbPath = dbPath
    this.initPromise = this.initializeDatabase()
  }

  async waitForReady(): Promise<void> {
    await this.initPromise
  }

  private async initializeDatabase() {
    try {
      const isDev = process.env.NODE_ENV === 'development'
      
      // Initialize sql.js with proper config for Electron
      this.SQL = await initSqlJs({
        locateFile: (file: string) => {
          if (isDev) {
            // In development, use node_modules path
            return path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', file)
          }
          // In production, wasm file is in resources folder (extraResources)
          // process.resourcesPath points to resources/ folder in packaged app
          return path.join(process.resourcesPath, file)
        }
      })
    } catch (error) {
      console.error('Failed to initialize sql.js:', error)
      throw error
    }
    
    // Load existing database or create new one
    if (fs.existsSync(this.dbPath)) {
      const buffer = fs.readFileSync(this.dbPath)
      this.db = new this.SQL.Database(buffer)
    } else {
      this.db = new this.SQL.Database()
    }

    // Create tables
    this.db.run(`
      CREATE TABLE IF NOT EXISTS tracks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        artist TEXT NOT NULL,
        album TEXT NOT NULL,
        albumArtist TEXT,
        year INTEGER,
        genre TEXT,
        duration REAL NOT NULL,
        filePath TEXT NOT NULL UNIQUE,
        trackNumber INTEGER,
        diskNumber INTEGER,
        bitrate INTEGER,
        sampleRate INTEGER,
        bitsPerSample INTEGER,
        coverArt TEXT,
        dateAdded TEXT NOT NULL
      )
    `)

    this.db.run(`
      CREATE TABLE IF NOT EXISTS playlists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        coverArt TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )
    `)

    this.db.run(`
      CREATE TABLE IF NOT EXISTS playlist_tracks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        playlistId INTEGER NOT NULL,
        trackId INTEGER NOT NULL,
        position INTEGER NOT NULL,
        addedAt TEXT NOT NULL,
        FOREIGN KEY (playlistId) REFERENCES playlists(id) ON DELETE CASCADE,
        FOREIGN KEY (trackId) REFERENCES tracks(id) ON DELETE CASCADE,
        UNIQUE(playlistId, trackId)
      )
    `)

    this.db.run(`CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist)`)
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_tracks_album ON tracks(album)`)
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_tracks_genre ON tracks(genre)`)
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_playlist_tracks_playlist ON playlist_tracks(playlistId)`)
    
    this.saveDatabase()
  }

  private saveDatabase() {
    if (this.db) {
      const data = this.db.export()
      fs.writeFileSync(this.dbPath, data)
    }
  }

  // Track operations
  insertTrack(track: Track): number {
    if (!this.db) throw new Error('Database not initialized')
    
    this.db.run(
      `INSERT INTO tracks (
        title, artist, album, albumArtist, year, genre, duration,
        filePath, trackNumber, diskNumber, bitrate, sampleRate,
        bitsPerSample, coverArt, dateAdded
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        track.title,
        track.artist,
        track.album,
        track.albumArtist || null,
        track.year || null,
        track.genre || null,
        track.duration,
        track.filePath,
        track.trackNumber || null,
        track.diskNumber || null,
        track.bitrate || null,
        track.sampleRate || null,
        track.bitsPerSample || null,
        track.coverArt || null,
        track.dateAdded
      ]
    )

    const result = this.db.exec('SELECT last_insert_rowid() as id')
    this.saveDatabase()
    return result[0].values[0][0] as number
  }

  getAllTracks(): Track[] {
    if (!this.db) return []
    
    const result = this.db.exec('SELECT * FROM tracks ORDER BY artist, album, trackNumber')
    if (result.length === 0) return []
    
    return this.rowsToObjects(result[0]) as Track[]
  }

  getTrackById(id: number): Track | undefined {
    if (!this.db) return undefined
    
    const result = this.db.exec('SELECT * FROM tracks WHERE id = ?', [id])
    if (result.length === 0 || result[0].values.length === 0) return undefined
    
    return this.rowsToObjects(result[0])[0] as Track
  }

  searchTracks(query: string): Track[] {
    if (!this.db) return []
    
    const searchPattern = `%${query}%`
    const result = this.db.exec(
      `SELECT * FROM tracks
       WHERE title LIKE ? OR artist LIKE ? OR album LIKE ? OR genre LIKE ?
       ORDER BY artist, album, trackNumber`,
      [searchPattern, searchPattern, searchPattern, searchPattern]
    )
    
    if (result.length === 0) return []
    return this.rowsToObjects(result[0]) as Track[]
  }

  trackExists(filePath: string): boolean {
    if (!this.db) return false
    
    const result = this.db.exec('SELECT id FROM tracks WHERE filePath = ?', [filePath])
    return result.length > 0 && result[0].values.length > 0
  }

  getTrackByFilePath(filePath: string): Track | undefined {
    if (!this.db) return undefined
    
    const result = this.db.exec('SELECT * FROM tracks WHERE filePath = ?', [filePath])
    if (result.length === 0 || result[0].values.length === 0) return undefined
    
    return this.rowsToObjects(result[0])[0] as Track
  }

  updateTrackCoverArt(id: number, coverArt: string): void {
    if (!this.db) throw new Error('Database not initialized')
    
    this.db.run('UPDATE tracks SET coverArt = ? WHERE id = ?', [coverArt, id])
    this.saveDatabase()
  }

  updateTrackMetadata(id: number, updates: { title?: string; artist?: string; album?: string; year?: number }): void {
    if (!this.db) throw new Error('Database not initialized')
    
    const setClauses: string[] = []
    const values: any[] = []
    
    if (updates.title !== undefined) {
      setClauses.push('title = ?')
      values.push(updates.title)
    }
    if (updates.artist !== undefined) {
      setClauses.push('artist = ?')
      values.push(updates.artist)
    }
    if (updates.album !== undefined) {
      setClauses.push('album = ?')
      values.push(updates.album)
    }
    if (updates.year !== undefined) {
      setClauses.push('year = ?')
      values.push(updates.year)
    }
    
    if (setClauses.length === 0) return
    
    values.push(id)
    this.db.run(`UPDATE tracks SET ${setClauses.join(', ')} WHERE id = ?`, values)
    this.saveDatabase()
  }

  getTracksWithoutCoverArt(): Track[] {
    if (!this.db) return []
    
    const result = this.db.exec(
      `SELECT * FROM tracks WHERE coverArt IS NULL OR coverArt = '' ORDER BY artist, album, trackNumber`
    )
    if (result.length === 0) return []
    
    return this.rowsToObjects(result[0]) as Track[]
  }

  // Playlist operations
  createPlaylist(name: string, description?: string): number {
    if (!this.db) throw new Error('Database not initialized')
    
    const now = new Date().toISOString()
    this.db.run(
      'INSERT INTO playlists (name, description, createdAt, updatedAt) VALUES (?, ?, ?, ?)',
      [name, description || null, now, now]
    )
    
    const result = this.db.exec('SELECT last_insert_rowid() as id')
    this.saveDatabase()
    return result[0].values[0][0] as number
  }

  getAllPlaylists(): Playlist[] {
    if (!this.db) return []
    
    const result = this.db.exec('SELECT * FROM playlists ORDER BY name')
    if (result.length === 0) return []
    
    return this.rowsToObjects(result[0]) as Playlist[]
  }

  getPlaylistById(id: number): Playlist | undefined {
    if (!this.db) return undefined
    
    const result = this.db.exec('SELECT * FROM playlists WHERE id = ?', [id])
    if (result.length === 0 || result[0].values.length === 0) return undefined
    
    return this.rowsToObjects(result[0])[0] as Playlist
  }

  getPlaylistTracks(playlistId: number): Track[] {
    if (!this.db) return []
    
    const result = this.db.exec(
      `SELECT t.* FROM tracks t
       INNER JOIN playlist_tracks pt ON t.id = pt.trackId
       WHERE pt.playlistId = ?
       ORDER BY pt.position`,
      [playlistId]
    )
    
    if (result.length === 0) return []
    return this.rowsToObjects(result[0]) as Track[]
  }

  addTrackToPlaylist(playlistId: number, trackId: number): void {
    if (!this.db) throw new Error('Database not initialized')
    
    const maxPosResult = this.db.exec(
      'SELECT MAX(position) as maxPos FROM playlist_tracks WHERE playlistId = ?',
      [playlistId]
    )
    
    const maxPos = maxPosResult[0]?.values[0]?.[0] as number | null
    const position = (maxPos || 0) + 1

    this.db.run(
      'INSERT INTO playlist_tracks (playlistId, trackId, position, addedAt) VALUES (?, ?, ?, ?)',
      [playlistId, trackId, position, new Date().toISOString()]
    )

    this.updatePlaylistTimestamp(playlistId)
    this.saveDatabase()
  }

  removeTrackFromPlaylist(playlistId: number, trackId: number): void {
    if (!this.db) throw new Error('Database not initialized')
    
    this.db.run(
      'DELETE FROM playlist_tracks WHERE playlistId = ? AND trackId = ?',
      [playlistId, trackId]
    )
    
    this.updatePlaylistTimestamp(playlistId)
    this.saveDatabase()
  }

  deleteTrack(id: number): void {
    if (!this.db) throw new Error('Database not initialized')
    
    this.db.run('DELETE FROM tracks WHERE id = ?', [id])
    this.saveDatabase()
  }

  deletePlaylist(id: number): void {
    if (!this.db) throw new Error('Database not initialized')
    
    this.db.run('DELETE FROM playlists WHERE id = ?', [id])
    this.saveDatabase()
  }

  renamePlaylist(id: number, name: string): void {
    if (!this.db) throw new Error('Database not initialized')
    
    this.db.run('UPDATE playlists SET name = ?, updatedAt = ? WHERE id = ?', [
      name,
      new Date().toISOString(),
      id
    ])
    
    this.saveDatabase()
  }

  private updatePlaylistTimestamp(id: number): void {
    if (!this.db) return
    
    this.db.run('UPDATE playlists SET updatedAt = ? WHERE id = ?', [
      new Date().toISOString(),
      id
    ])
  }

  private rowsToObjects(result: any): any[] {
    if (!result.columns || !result.values) return []
    
    return result.values.map((row: any[]) => {
      const obj: any = {}
      result.columns.forEach((col: string, index: number) => {
        obj[col] = row[index]
      })
      return obj
    })
  }

  close() {
    if (this.db) {
      this.saveDatabase()
      this.db.close()
      this.db = null
    }
  }
}
