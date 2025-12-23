import { useEffect, useRef } from 'react'
import { usePlayerStore } from '../store/playerStore'

export const audioRef = { current: null as HTMLAudioElement | null }

// Umbral de silencio en dB (más negativo = más silencioso)
const SILENCE_THRESHOLD = 0.01 // Nivel de amplitud considerado silencio
const SILENCE_CHECK_INTERVAL = 0.05 // Cada 50ms revisar el audio
const MAX_SILENCE_SKIP = 10 // Máximo segundos a saltar al inicio

export const useAudioPlayer = () => {
  const scrobbledRef = useRef<boolean>(false)
  const nowPlayingUpdatedRef = useRef<boolean>(false)
  const silenceCheckedRef = useRef<boolean>(false)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null)
  
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

  // Función para detectar si el audio actual es silencio
  const isCurrentlySilent = (): boolean => {
    if (!analyserRef.current) return false
    
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
    analyserRef.current.getByteFrequencyData(dataArray)
    
    // Calcular el promedio de amplitud
    const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
    const normalized = average / 255 // Normalizar a 0-1
    
    return normalized < SILENCE_THRESHOLD
  }

  // Función para saltar el silencio inicial
  const skipInitialSilence = async () => {
    if (!audioRef.current || silenceCheckedRef.current) return
    
    const startTime = audioRef.current.currentTime
    let silenceEnd = startTime
    
    // Solo revisar si estamos al inicio (primeros 2 segundos)
    if (startTime > 2) {
      silenceCheckedRef.current = true
      return
    }
    
    // Buscar dónde termina el silencio
    const checkSilence = () => {
      if (!audioRef.current) return
      
      if (audioRef.current.currentTime >= MAX_SILENCE_SKIP) {
        // No saltar más de MAX_SILENCE_SKIP segundos
        silenceCheckedRef.current = true
        return
      }
      
      if (isCurrentlySilent()) {
        silenceEnd = audioRef.current.currentTime
        // Seguir adelantando
        audioRef.current.currentTime += SILENCE_CHECK_INTERVAL
        requestAnimationFrame(checkSilence)
      } else {
        // Encontramos audio, marcar como revisado
        silenceCheckedRef.current = true
        if (silenceEnd > startTime + 0.5) {
          console.log(`[AudioPlayer] Silencio inicial detectado, saltando ${silenceEnd.toFixed(2)}s`)
          audioRef.current.currentTime = silenceEnd
        }
      }
    }
    
    // Esperar un poco a que el analyser tenga datos
    setTimeout(() => {
      if (audioRef.current && isPlaying) {
        checkSilence()
      }
    }, 100)
  }

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio()
      
      // Crear AudioContext para análisis de audio
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      analyserRef.current = audioContextRef.current.createAnalyser()
      analyserRef.current.fftSize = 256
      
      // Conectar el elemento de audio al analyser
      sourceNodeRef.current = audioContextRef.current.createMediaElementSource(audioRef.current)
      sourceNodeRef.current.connect(analyserRef.current)
      analyserRef.current.connect(audioContextRef.current.destination)
      
      // Setup event listeners
      audioRef.current.addEventListener('loadedmetadata', () => {
        setDuration(audioRef.current?.duration || 0)
      })

      audioRef.current.addEventListener('timeupdate', handleTimeUpdate)

      audioRef.current.addEventListener('ended', handleTrackEnded)

      audioRef.current.addEventListener('error', (e) => {
        console.error('Audio error:', e)
        setIsPlaying(false)
      })
      
      // Detectar silencio cuando empieza a reproducir
      audioRef.current.addEventListener('playing', () => {
        if (!silenceCheckedRef.current) {
          skipInitialSilence()
        }
      })
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
  }, [])

  // Manejar cuando la canción termina
  const handleTrackEnded = () => {
    const state = usePlayerStore.getState()
    if (state.isAnimeMode) {
      // En modo anime, reiniciar la canción
      if (audioRef.current) {
        audioRef.current.currentTime = 0
        audioRef.current.play()
      }
    } else {
      // Modo normal, ir a la siguiente
      playNext()
    }
  }

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
      silenceCheckedRef.current = false // Reset silence check para nueva canción
      
      // Resumir AudioContext si estaba suspendido (política de autoplay)
      if (audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume()
      }
      
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
