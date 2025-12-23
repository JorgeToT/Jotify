import { contextBridge, ipcRenderer } from 'electron'

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  // Dialog
  selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),

  // Library
  scanLibrary: (folderPath: string) => ipcRenderer.invoke('library:scan', folderPath),
  getTracks: () => ipcRenderer.invoke('library:getTracks'),
  getTrack: (id: number) => ipcRenderer.invoke('library:getTrack', id),
  searchTracks: (query: string) => ipcRenderer.invoke('library:search', query),
  searchMetadata: (artist: string, title: string) => 
    ipcRenderer.invoke('library:searchMetadata', artist, title),
  updateTrack: (id: number, updates: { title?: string; artist?: string; album?: string; year?: number }) =>
    ipcRenderer.invoke('library:updateTrack', id, updates),
  searchCover: (id: number) => ipcRenderer.invoke('library:searchCover', id),
  deleteTrack: (id: number, deleteFromDisk: boolean = true) => 
    ipcRenderer.invoke('library:deleteTrack', id, deleteFromDisk),
  fixCovers: () => ipcRenderer.invoke('library:fixCovers'),

  // Playlists
  createPlaylist: (name: string) => ipcRenderer.invoke('playlist:create', name),
  getAllPlaylists: () => ipcRenderer.invoke('playlist:getAll'),
  getPlaylistById: (id: number) => ipcRenderer.invoke('playlist:getById', id),
  addToPlaylist: (playlistId: number, trackId: number) => 
    ipcRenderer.invoke('playlist:addTrack', playlistId, trackId),
  removeTrackFromPlaylist: (playlistId: number, trackId: number) => 
    ipcRenderer.invoke('playlist:removeTrack', playlistId, trackId),
  deletePlaylist: (id: number) => ipcRenderer.invoke('playlist:delete', id),
  renamePlaylist: (id: number, name: string) => ipcRenderer.invoke('playlist:rename', id, name),

  // App
  getVersion: () => ipcRenderer.invoke('app:getVersion'),

  // Last.fm
  lastfm: {
    getAuthUrl: () => ipcRenderer.invoke('lastfm:getAuthUrl'),
    authenticate: (token: string) => ipcRenderer.invoke('lastfm:authenticate', token),
    isAuthenticated: () => ipcRenderer.invoke('lastfm:isAuthenticated'),
    getUsername: () => ipcRenderer.invoke('lastfm:getUsername'),
    updateNowPlaying: (track: any) => ipcRenderer.invoke('lastfm:updateNowPlaying', track),
    scrobble: (track: any, timestamp?: number) => ipcRenderer.invoke('lastfm:scrobble', track, timestamp),
    getTrackInfo: (artist: string, track: string, album?: string) => 
      ipcRenderer.invoke('lastfm:getTrackInfo', artist, track, album),
    getSimilarTracks: (artist: string, track: string, limit?: number) => 
      ipcRenderer.invoke('lastfm:getSimilarTracks', artist, track, limit),
    getRecentTracks: (limit?: number) => ipcRenderer.invoke('lastfm:getRecentTracks', limit),
    disconnect: () => ipcRenderer.invoke('lastfm:disconnect'),
  },

  // Downloads
  download: {
    searchMusic: (query: string, limit?: number) => 
      ipcRenderer.invoke('download:searchMusic', query, limit),
    getMediaInfo: (url: string) => ipcRenderer.invoke('download:getMediaInfo', url),
    downloadTrack: (url: string, format: string) => 
      ipcRenderer.invoke('download:track', url, format),
    queueDownload: (url: string, format: string, title?: string, thumbnail?: string) =>
      ipcRenderer.invoke('download:queue', url, format, title, thumbnail),
    cancelDownload: (downloadId: string) =>
      ipcRenderer.invoke('download:cancel', downloadId),
    checkYtDlp: () => ipcRenderer.invoke('download:checkYtDlp'),
    updateYtDlp: () => ipcRenderer.invoke('download:updateYtDlp'),
    selectOutputPath: () => ipcRenderer.invoke('download:selectOutputPath'),
    onProgress: (callback: (progress: any) => void) => {
      ipcRenderer.on('download:progress', (_, progress) => callback(progress))
    },
    removeProgressListener: () => {
      ipcRenderer.removeAllListeners('download:progress')
    },
  },

  // Library events
  library: {
    getTracks: () => ipcRenderer.invoke('library:getTracks'),
    getPlaylists: () => ipcRenderer.invoke('playlist:getAll'),
    onUpdated: (callback: () => void) => {
      ipcRenderer.on('library:updated', () => callback())
    },
    removeUpdatedListener: () => {
      ipcRenderer.removeAllListeners('library:updated')
    },
  },

  // Settings
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    save: (settings: any) => ipcRenderer.invoke('settings:save', settings),
  },

  // Anime images
  anime: {
    getRandomImage: () => ipcRenderer.invoke('anime:getRandomImage'),
    getMultipleImages: (count: number) => ipcRenderer.invoke('anime:getMultipleImages', count),
    getSafebooruImages: (tags: string[], count?: number) => 
      ipcRenderer.invoke('anime:getSafebooruImages', tags, count),
    getNekosBestImages: (categories: string[], count?: number) => 
      ipcRenderer.invoke('anime:getNekosBestImages', categories, count),
    getWaifuPicsImages: (categories: string[], count?: number) => 
      ipcRenderer.invoke('anime:getWaifuPicsImages', categories, count),
    selectLocalFolder: () => ipcRenderer.invoke('anime:selectLocalFolder'),
    getLocalImages: (folderPath: string, count?: number) => 
      ipcRenderer.invoke('anime:getLocalImages', folderPath, count),
  },

  // Shell
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
})
