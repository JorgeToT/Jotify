import { create } from 'zustand'
import { Track, Playlist } from '../types/electron'

interface LibraryState {
  tracks: Track[]
  playlists: Playlist[]
  isLoading: boolean
  error: string | null

  // Actions
  loadTracks: () => Promise<void>
  loadPlaylists: () => Promise<void>
  setTracks: (tracks: Track[]) => void
  setPlaylists: (playlists: Playlist[]) => void
  addPlaylist: (playlist: Playlist) => void
  updatePlaylist: (id: number, playlist: Partial<Playlist>) => void
  removePlaylist: (id: number) => void
  setLoading: (isLoading: boolean) => void
  setError: (error: string | null) => void
}

export const useLibraryStore = create<LibraryState>((set) => ({
  tracks: [],
  playlists: [],
  isLoading: false,
  error: null,

  loadTracks: async () => {
    set({ isLoading: true })
    try {
      const tracks = await window.electron.library.getTracks()
      set({ tracks, isLoading: false })
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false })
    }
  },

  loadPlaylists: async () => {
    try {
      const playlists = await window.electron.library.getPlaylists()
      set({ playlists })
    } catch (error) {
      console.error('Error loading playlists:', error)
    }
  },

  setTracks: (tracks) => set({ tracks }),
  setPlaylists: (playlists) => set({ playlists }),
  
  addPlaylist: (playlist) => set((state) => ({
    playlists: [...state.playlists, playlist]
  })),

  updatePlaylist: (id, updatedPlaylist) => set((state) => ({
    playlists: state.playlists.map((p) =>
      p.id === id ? { ...p, ...updatedPlaylist } : p
    )
  })),

  removePlaylist: (id) => set((state) => ({
    playlists: state.playlists.filter((p) => p.id !== id)
  })),

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
}))
