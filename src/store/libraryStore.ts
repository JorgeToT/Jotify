import { create } from 'zustand'
import { Track, Playlist } from '../types/electron'

interface LibraryState {
  tracks: Track[]
  playlists: Playlist[]
  isLoading: boolean
  error: string | null

  // Actions
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
