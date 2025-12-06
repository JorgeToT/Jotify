import { DatabaseManager, Playlist, Track } from './database'

export class PlaylistManager {
  private dbManager: DatabaseManager

  constructor(dbManager: DatabaseManager) {
    this.dbManager = dbManager
  }

  createPlaylist(name: string, description?: string): Playlist {
    const id = this.dbManager.createPlaylist(name, description)
    const playlist = this.dbManager.getPlaylistById(id)
    if (!playlist) {
      throw new Error('Failed to create playlist')
    }
    return playlist
  }

  getAllPlaylists(): Playlist[] {
    return this.dbManager.getAllPlaylists()
  }

  getPlaylistById(id: number): { playlist: Playlist; tracks: Track[] } | null {
    const playlist = this.dbManager.getPlaylistById(id)
    if (!playlist) {
      return null
    }
    const tracks = this.dbManager.getPlaylistTracks(id)
    return { playlist, tracks }
  }

  addTrackToPlaylist(playlistId: number, trackId: number): boolean {
    try {
      this.dbManager.addTrackToPlaylist(playlistId, trackId)
      return true
    } catch (error) {
      console.error('Error adding track to playlist:', error)
      return false
    }
  }

  removeTrackFromPlaylist(playlistId: number, trackId: number): boolean {
    try {
      this.dbManager.removeTrackFromPlaylist(playlistId, trackId)
      return true
    } catch (error) {
      console.error('Error removing track from playlist:', error)
      return false
    }
  }

  deletePlaylist(id: number): boolean {
    try {
      this.dbManager.deletePlaylist(id)
      return true
    } catch (error) {
      console.error('Error deleting playlist:', error)
      return false
    }
  }

  renamePlaylist(id: number, name: string): boolean {
    try {
      this.dbManager.renamePlaylist(id, name)
      return true
    } catch (error) {
      console.error('Error renaming playlist:', error)
      return false
    }
  }
}
