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

  // Playlists
  createPlaylist: (name: string) => ipcRenderer.invoke('playlist:create', name),
  getAllPlaylists: () => ipcRenderer.invoke('playlist:getAll'),
  getPlaylistById: (id: number) => ipcRenderer.invoke('playlist:getById', id),
  addTrackToPlaylist: (playlistId: number, trackId: number) => 
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
    checkYtDlp: () => ipcRenderer.invoke('download:checkYtDlp'),
    updateYtDlp: () => ipcRenderer.invoke('download:updateYtDlp'),
    selectOutputPath: () => ipcRenderer.invoke('download:selectOutputPath'),
    onProgress: (callback: (progress: any) => void) => {
      ipcRenderer.on('download:progress', (_, progress) => callback(progress))
    },
  },

  // Settings
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    save: (settings: any) => ipcRenderer.invoke('settings:save', settings),
  },

  // Shell
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
})
