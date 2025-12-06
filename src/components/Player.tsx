import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Repeat, Repeat1, Shuffle } from 'lucide-react'
import { usePlayerStore } from '../store/playerStore'
import { formatTime } from '../utils/formatTime'
import { audioRef } from '../hooks/useAudioPlayer'
import './Player.css'

export default function Player() {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    repeatMode,
    isShuffled,
    setIsPlaying,
    setVolume,
    toggleMute,
    setRepeatMode,
    toggleShuffle,
    playNext,
    playPrevious,
    seek,
  } = usePlayerStore()

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value)
    if (audioRef.current) {
      audioRef.current.currentTime = time
      seek(time)
    }
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(parseFloat(e.target.value))
  }

  const handleRepeatClick = () => {
    const modes: Array<'off' | 'all' | 'one'> = ['off', 'all', 'one']
    const currentIndex = modes.indexOf(repeatMode)
    const nextMode = modes[(currentIndex + 1) % modes.length]
    setRepeatMode(nextMode)
  }

  const getRepeatIcon = () => {
    if (repeatMode === 'one') return <Repeat1 size={20} />
    return <Repeat size={20} />
  }

  return (
    <div className="player">
      <div className="player-track-info">
        {currentTrack ? (
          <>
            {currentTrack.coverArt && (
              <img 
                src={currentTrack.coverArt} 
                alt={currentTrack.album}
                className="player-cover"
              />
            )}
            <div className="player-text">
              <div className="player-title">{currentTrack.title}</div>
              <div className="player-artist">{currentTrack.artist}</div>
            </div>
          </>
        ) : (
          <div className="player-text">
            <div className="player-title">No hay reproducción</div>
            <div className="player-artist">Selecciona una canción</div>
          </div>
        )}
      </div>

      <div className="player-controls">
        <div className="player-buttons">
          <button
            className={`control-btn ${isShuffled ? 'active' : ''}`}
            onClick={toggleShuffle}
            title="Aleatorio"
          >
            <Shuffle size={20} />
          </button>
          
          <button 
            className="control-btn"
            onClick={playPrevious}
            disabled={!currentTrack}
          >
            <SkipBack size={24} />
          </button>
          
          <button
            className="play-btn"
            onClick={() => setIsPlaying(!isPlaying)}
            disabled={!currentTrack}
          >
            {isPlaying ? <Pause size={24} /> : <Play size={24} />}
          </button>
          
          <button
            className="control-btn"
            onClick={playNext}
            disabled={!currentTrack}
          >
            <SkipForward size={24} />
          </button>
          
          <button
            className={`control-btn ${repeatMode !== 'off' ? 'active' : ''}`}
            onClick={handleRepeatClick}
            title={`Repetir: ${repeatMode}`}
          >
            {getRepeatIcon()}
          </button>
        </div>

        <div className="player-progress">
          <span className="time">{formatTime(currentTime)}</span>
          <input
            type="range"
            className="progress-bar"
            min="0"
            max={duration || 0}
            value={currentTime}
            onChange={handleSeek}
            disabled={!currentTrack}
          />
          <span className="time">{formatTime(duration)}</span>
        </div>
      </div>

      <div className="player-volume">
        <button onClick={toggleMute} className="control-btn">
          {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
        </button>
        <input
          type="range"
          className="volume-bar"
          min="0"
          max="1"
          step="0.01"
          value={isMuted ? 0 : volume}
          onChange={handleVolumeChange}
        />
      </div>
    </div>
  )
}
