import { useEffect, useRef } from 'react'
import { usePlayerStore } from '../store/playerStore'

export const audioRef = { current: null as HTMLAudioElement | null }

export const useAudioPlayer = () => {
  const scrobbledRef = useRef<boolean>(false)
  const nowPlayingUpdatedRef = useRef<boolean>(false)
  
  const {
    currentTrack,
    isPlaying,
    volume,
    isMuted,
    setIsPlaying,
    setCurrentTime,
    setDuration,
    playNext,
  } = usePlayerStore()

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio()
      
      // Setup event listeners
      audioRef.current.addEventListener('loadedmetadata', () => {
        setDuration(audioRef.current?.duration || 0)
      })

      audioRef.current.addEventListener('timeupdate', handleTimeUpdate)

      audioRef.current.addEventListener('ended', () => {
        playNext()
      })

      audioRef.current.addEventListener('error', (e) => {
        console.error('Audio error:', e)
        setIsPlaying(false)
      })
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  // Handle time update and Last.fm scrobbling
  const handleTimeUpdate = async () => {
    const currentTime = audioRef.current?.currentTime || 0
    const duration = audioRef.current?.duration || 0
    
    setCurrentTime(currentTime)

    // Update Now Playing on Last.fm when track starts
    if (currentTime > 1 && !nowPlayingUpdatedRef.current && currentTrack) {
      nowPlayingUpdatedRef.current = true
      
      try {
        const isAuth = await window.electron.lastfm.isAuthenticated()
        if (isAuth) {
          await window.electron.lastfm.updateNowPlaying(currentTrack)
        }
      } catch (error) {
        console.error('Error updating now playing:', error)
      }
    }

    // Scrobble to Last.fm after 50% or 240 seconds, whichever comes first
    const scrobbleThreshold = Math.min(duration * 0.5, 240)
    if (currentTime >= scrobbleThreshold && !scrobbledRef.current && currentTrack) {
      scrobbledRef.current = true
      
      try {
        const isAuth = await window.electron.lastfm.isAuthenticated()
        if (isAuth) {
          await window.electron.lastfm.scrobble(currentTrack, Date.now())
          console.log('Track scrobbled to Last.fm:', currentTrack.title)
        }
      } catch (error) {
        console.error('Error scrobbling:', error)
      }
    }
  }

  // Handle track changes
  useEffect(() => {
    if (currentTrack && audioRef.current) {
      // Reset scrobble flags
      scrobbledRef.current = false
      nowPlayingUpdatedRef.current = false
      
      // Use local-file:// protocol for local files in Electron
      const audioUrl = `local-file://${encodeURIComponent(currentTrack.filePath)}`
      console.log('Setting audio source:', audioUrl)
      audioRef.current.src = audioUrl
      audioRef.current.load()
      
      if (isPlaying) {
        console.log('Attempting to play...')
        audioRef.current.play().catch((error) => {
          console.error('Playback error:', error)
          setIsPlaying(false)
        })
      }
    }
  }, [currentTrack])

  // Handle play/pause
  useEffect(() => {
    console.log('Play state changed:', isPlaying, 'Audio ref exists:', !!audioRef.current)
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play().catch((error) => {
          console.error('Playback error:', error)
          setIsPlaying(false)
        })
      } else {
        audioRef.current.pause()
      }
    }
  }, [isPlaying])

  // Handle volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume
    }
  }, [volume, isMuted])
}
