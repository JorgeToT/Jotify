import { create } from 'zustand'
import { Track } from '../types/electron'

interface PlayerState {
  currentTrack: Track | null
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  isMuted: boolean
  repeatMode: 'off' | 'all' | 'one'
  isShuffled: boolean
  queue: Track[]
  originalQueue: Track[]
  currentIndex: number

  // Actions
  setCurrentTrack: (track: Track | null) => void
  setIsPlaying: (isPlaying: boolean) => void
  setCurrentTime: (time: number) => void
  setDuration: (duration: number) => void
  setVolume: (volume: number) => void
  toggleMute: () => void
  setRepeatMode: (mode: 'off' | 'all' | 'one') => void
  toggleShuffle: () => void
  setQueue: (tracks: Track[], startIndex?: number) => void
  playNext: () => void
  playPrevious: () => void
  playTrackAtIndex: (index: number) => void
  seek: (time: number) => void
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentTrack: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 0.7,
  isMuted: false,
  repeatMode: 'off',
  isShuffled: false,
  queue: [],
  originalQueue: [],
  currentIndex: -1,

  setCurrentTrack: (track) => set({ currentTrack: track }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setDuration: (duration) => set({ duration }),
  setVolume: (volume) => set({ volume }),
  
  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),

  setRepeatMode: (mode) => set({ repeatMode: mode }),

  toggleShuffle: () => {
    const state = get()
    const newShuffled = !state.isShuffled

    if (newShuffled) {
      // Shuffle the queue
      const currentTrack = state.queue[state.currentIndex]
      const otherTracks = state.queue.filter((_, i) => i !== state.currentIndex)
      const shuffled = [...otherTracks].sort(() => Math.random() - 0.5)
      const newQueue = currentTrack ? [currentTrack, ...shuffled] : shuffled
      
      set({
        isShuffled: true,
        originalQueue: [...state.queue],
        queue: newQueue,
        currentIndex: 0,
      })
    } else {
      // Restore original order
      set({
        isShuffled: false,
        queue: [...state.originalQueue],
        originalQueue: [],
      })
    }
  },

  setQueue: (tracks, startIndex = 0) => set({ 
    queue: tracks, 
    originalQueue: [],
    isShuffled: false,
    currentIndex: startIndex 
  }),

  playNext: () => {
    const { queue, currentIndex, repeatMode } = get()
    
    if (repeatMode === 'one') {
      set({ currentTime: 0 })
      return
    }

    let nextIndex = currentIndex + 1

    if (nextIndex >= queue.length) {
      if (repeatMode === 'all') {
        nextIndex = 0
      } else {
        set({ isPlaying: false })
        return
      }
    }

    set({
      currentIndex: nextIndex,
      currentTrack: queue[nextIndex],
      currentTime: 0,
    })
  },

  playPrevious: () => {
    const { queue, currentIndex, currentTime } = get()

    // If more than 3 seconds into the song, restart it
    if (currentTime > 3) {
      set({ currentTime: 0 })
      return
    }

    let prevIndex = currentIndex - 1

    if (prevIndex < 0) {
      prevIndex = queue.length - 1
    }

    set({
      currentIndex: prevIndex,
      currentTrack: queue[prevIndex],
      currentTime: 0,
    })
  },

  playTrackAtIndex: (index) => {
    const { queue } = get()
    if (index >= 0 && index < queue.length) {
      set({
        currentIndex: index,
        currentTrack: queue[index],
        currentTime: 0,
        isPlaying: true,
      })
    }
  },

  seek: (time) => set({ currentTime: time }),
}))
