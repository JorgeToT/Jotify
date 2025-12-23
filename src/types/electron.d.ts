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

export interface DownloadProgressEvent {
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
}

export interface MusicBrainzResult {
  id: string
  title: string
  artist: string
  album?: string
  year?: number
  duration?: number
}

export interface ElectronAPI {
  selectFolder: () => Promise<string>
  scanLibrary: (folderPath: string) => Promise<{ success: boolean; count?: number; error?: string }>
  getTracks: () => Promise<Track[]>
  getTrack: (id: number) => Promise<Track | undefined>
  searchTracks: (query: string) => Promise<Track[]>
  searchMetadata: (artist: string, title: string) => Promise<{ success: boolean; data?: MusicBrainzResult; error?: string }>
  updateTrack: (id: number, updates: { title?: string; artist?: string; album?: string; year?: number }) => Promise<{ success: boolean; error?: string }>
  searchCover: (id: number) => Promise<{ success: boolean; coverPath?: string; error?: string }>
  deleteTrack: (id: number, deleteFromDisk?: boolean) => Promise<{ success: boolean; error?: string }>
  fixCovers: () => Promise<{ success: boolean; fixed?: number; failed?: number; total?: number; error?: string }>
  createPlaylist: (name: string) => Promise<Playlist>
  getAllPlaylists: () => Promise<Playlist[]>
  getPlaylistById: (id: number) => Promise<{ playlist: Playlist; tracks: Track[] } | null>
  addToPlaylist: (playlistId: number, trackId: number) => Promise<boolean>
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
    queueDownload: (url: string, format: string, title?: string, thumbnail?: string) => Promise<{ success: boolean; downloadId?: string; error?: string }>
    cancelDownload: (downloadId: string) => Promise<{ success: boolean }>
    checkYtDlp: () => Promise<boolean>
    updateYtDlp: () => Promise<{ success: boolean; message: string }>
    selectOutputPath: () => Promise<string | null>
    onProgress: (callback: (progress: DownloadProgressEvent) => void) => void
    removeProgressListener: () => void
  }
  
  settings: {
    get: () => Promise<any>
    save: (settings: any) => Promise<{ success: boolean }>
  }

  anime: {
    getRandomImage: () => Promise<{ success: boolean; url?: string; error?: string }>
    getMultipleImages: (count: number) => Promise<{ success: boolean; images?: string[]; error?: string }>
  }

  library: {
    getTracks: () => Promise<Track[]>
    getPlaylists: () => Promise<Playlist[]>
    onUpdated: (callback: () => void) => void
    removeUpdatedListener: () => void
  }
  
  openExternal: (url: string) => Promise<void>
}

declare global {
  interface Window {
    electron: ElectronAPI
  }
}

export {}
