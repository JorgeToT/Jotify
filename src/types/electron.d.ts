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
  tracks?: Track[]
}

export interface ElectronAPI {
  selectFolder: () => Promise<string>
  scanLibrary: (folderPath: string) => Promise<{ success: boolean; count?: number; error?: string }>
  getTracks: () => Promise<Track[]>
  getTrack: (id: number) => Promise<Track | undefined>
  searchTracks: (query: string) => Promise<Track[]>
  createPlaylist: (name: string) => Promise<Playlist>
  getAllPlaylists: () => Promise<Playlist[]>
  getPlaylistById: (id: number) => Promise<{ playlist: Playlist; tracks: Track[] } | null>
  addTrackToPlaylist: (playlistId: number, trackId: number) => Promise<boolean>
  removeTrackFromPlaylist: (playlistId: number, trackId: number) => Promise<boolean>
  deletePlaylist: (id: number) => Promise<boolean>
  renamePlaylist: (id: number, name: string) => Promise<boolean>
  getVersion: () => Promise<string>
  
  lastfm: {
    getAuthUrl: () => Promise<string>
    authenticate: (token: string) => Promise<{ success: boolean; username?: string; error?: string }>
    isAuthenticated: () => Promise<boolean>
    getUsername: () => Promise<string | undefined>
    updateNowPlaying: (track: Track) => Promise<{ success: boolean; error?: string }>
    scrobble: (track: Track, timestamp?: number) => Promise<{ success: boolean; error?: string }>
    getTrackInfo: (artist: string, track: string, album?: string) => Promise<any>
    getSimilarTracks: (artist: string, track: string, limit?: number) => Promise<any[]>
    getRecentTracks: (limit?: number) => Promise<any[]>
    disconnect: () => Promise<{ success: boolean }>
  }
  
  download: {
    searchMusic: (query: string, limit?: number) => Promise<{ success: boolean; results?: any[]; error?: string }>
    getMediaInfo: (url: string) => Promise<{ success: boolean; info?: any; error?: string }>
    downloadTrack: (url: string, format: string) => Promise<{ success: boolean; message?: string; error?: string }>
    checkYtDlp: () => Promise<boolean>
    updateYtDlp: () => Promise<{ success: boolean; message: string }>
    selectOutputPath: () => Promise<string | null>
    onProgress: (callback: (progress: any) => void) => void
  }
  
  settings: {
    get: () => Promise<any>
    save: (settings: any) => Promise<{ success: boolean }>
  }
  
  openExternal: (url: string) => Promise<void>
}

declare global {
  interface Window {
    electron: ElectronAPI
  }
}

export {}
