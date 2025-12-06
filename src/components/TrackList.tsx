import { Track } from '../types/electron'
import { Play, MoreVertical } from 'lucide-react'
import { usePlayerStore } from '../store/playerStore'
import { formatTime } from '../utils/formatTime'
import './TrackList.css'

interface TrackListProps {
  tracks: Track[]
}

export default function TrackList({ tracks }: TrackListProps) {
  const { currentTrack, setQueue, setCurrentTrack, setIsPlaying } = usePlayerStore()

  const handlePlayTrack = (track: Track, index: number) => {
    console.log('Playing track:', track.title, 'at index:', index)
    console.log('Track path:', track.filePath)
    setQueue(tracks, index)
    setCurrentTrack(track)
    setIsPlaying(true)
  }

  const formatBitrate = (bitrate?: number) => {
    if (!bitrate) return ''
    return `${Math.round(bitrate / 1000)} kbps`
  }

  const formatSampleRate = (sampleRate?: number, bitsPerSample?: number) => {
    if (!sampleRate) return ''
    const khz = sampleRate / 1000
    const bits = bitsPerSample ? `/${bitsPerSample}bit` : ''
    return `${khz}kHz${bits}`
  }

  return (
    <div className="track-list">
      <div className="track-list-header">
        <div className="track-header-number">#</div>
        <div className="track-header-title">Título</div>
        <div className="track-header-album">Álbum</div>
        <div className="track-header-quality">Calidad</div>
        <div className="track-header-duration">Duración</div>
      </div>

      <div className="track-list-body">
        {tracks.map((track, index) => (
          <div
            key={track.id}
            className={`track-row ${currentTrack?.id === track.id ? 'active' : ''}`}
            onDoubleClick={() => handlePlayTrack(track, index)}
          >
            <div className="track-number">
              <span className="track-index">{index + 1}</span>
              <button
                className="track-play-btn"
                onClick={() => handlePlayTrack(track, index)}
              >
                <Play size={16} />
              </button>
            </div>

            <div className="track-info">
              {track.coverArt && (
                <img src={track.coverArt} alt={track.album} className="track-cover" />
              )}
              <div className="track-text">
                <div className="track-title">{track.title}</div>
                <div className="track-artist">{track.artist}</div>
              </div>
            </div>

            <div className="track-album">{track.album}</div>

            <div className="track-quality">
              <div className="quality-badge">FLAC</div>
              <div className="quality-details">
                {formatSampleRate(track.sampleRate, track.bitsPerSample)}
                {track.bitrate && ` · ${formatBitrate(track.bitrate)}`}
              </div>
            </div>

            <div className="track-duration">
              {formatTime(track.duration)}
            </div>

            <button className="track-more">
              <MoreVertical size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
