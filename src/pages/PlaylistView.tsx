import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Playlist, Track } from '../types/electron'
import TrackList from '../components/TrackList'
import './PlaylistView.css'

export default function PlaylistView() {
  const { id } = useParams<{ id: string }>()
  const [playlist, setPlaylist] = useState<Playlist | null>(null)
  const [tracks, setTracks] = useState<Track[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadPlaylist()
  }, [id])

  const loadPlaylist = async () => {
    if (!id) return

    try {
      const data = await window.electron.getPlaylistById(parseInt(id))
      if (data) {
        setPlaylist(data.playlist)
        setTracks(data.tracks)
      }
    } catch (error) {
      console.error('Error loading playlist:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="playlist-view">
        <p>Cargando...</p>
      </div>
    )
  }

  if (!playlist) {
    return (
      <div className="playlist-view">
        <h1 className="page-title">Playlist no encontrada</h1>
      </div>
    )
  }

  return (
    <div className="playlist-view">
      <div className="playlist-header">
        <div className="playlist-cover">
          {playlist.coverArt ? (
            <img src={playlist.coverArt} alt={playlist.name} />
          ) : (
            <div className="playlist-cover-placeholder">
              <span>♫</span>
            </div>
          )}
        </div>
        <div className="playlist-info">
          <span className="playlist-type">Playlist</span>
          <h1 className="playlist-name">{playlist.name}</h1>
          {playlist.description && (
            <p className="playlist-description">{playlist.description}</p>
          )}
          <div className="playlist-meta">
            {tracks.length} canciones
          </div>
        </div>
      </div>

      {tracks.length > 0 ? (
        <TrackList tracks={tracks} />
      ) : (
        <div className="empty-playlist">
          <h2>Esta playlist está vacía</h2>
          <p>Agrega canciones desde tu biblioteca</p>
        </div>
      )}
    </div>
  )
}
