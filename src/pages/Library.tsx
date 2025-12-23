import { useState, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useLibraryStore } from '../store/libraryStore'
import { usePlayerStore } from '../store/playerStore'
import TrackList from '../components/TrackList'
import './Library.css'

type ViewType = 'songs' | 'artists' | 'albums' | 'playlists'

export default function Library() {
  const { tracks, playlists, isLoading } = useLibraryStore()
  const { setCurrentTrack, setPlaylist, setIsPlaying } = usePlayerStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  
  const viewParam = searchParams.get('view') as ViewType | null
  const currentView: ViewType = viewParam || 'songs'
  const [selectedArtist, setSelectedArtist] = useState<string | null>(null)
  const [selectedAlbum, setSelectedAlbum] = useState<string | null>(null)

  const setView = (view: ViewType) => {
    setSearchParams({ view })
    setSelectedArtist(null)
    setSelectedAlbum(null)
  }

  // Agrupar por artistas
  const artists = useMemo(() => {
    const artistMap = new Map<string, typeof tracks>()
    tracks.forEach(track => {
      const existing = artistMap.get(track.artist) || []
      artistMap.set(track.artist, [...existing, track])
    })
    return Array.from(artistMap.entries()).map(([name, tracks]) => ({
      name,
      trackCount: tracks.length,
      tracks
    })).sort((a, b) => a.name.localeCompare(b.name))
  }, [tracks])

  // Agrupar por álbumes
  const albums = useMemo(() => {
    const albumMap = new Map<string, { artist: string; tracks: typeof tracks; coverArt?: string }>()
    tracks.forEach(track => {
      const key = `${track.album}||${track.artist}`
      const existing = albumMap.get(key)
      if (existing) {
        existing.tracks.push(track)
      } else {
        albumMap.set(key, { 
          artist: track.artist, 
          tracks: [track],
          coverArt: track.coverArt
        })
      }
    })
    return Array.from(albumMap.entries()).map(([key, data]) => ({
      name: key.split('||')[0],
      artist: data.artist,
      trackCount: data.tracks.length,
      tracks: data.tracks,
      coverArt: data.coverArt
    })).sort((a, b) => a.name.localeCompare(b.name))
  }, [tracks])

  if (isLoading) {
    return (
      <div className="library">
        <h1 className="page-title">Tu Biblioteca</h1>
        <p>Cargando...</p>
      </div>
    )
  }

  if (tracks.length === 0 && currentView !== 'playlists') {
    return (
      <div className="library">
        <h1 className="page-title">Tu Biblioteca</h1>
        <div className="empty-state">
          <h2>Tu biblioteca está vacía</h2>
          <p>Usa el botón "Escanear música" en la barra lateral para agregar tus archivos FLAC.</p>
        </div>
      </div>
    )
  }

  const renderContent = () => {
    switch (currentView) {
      case 'artists':
        if (selectedArtist) {
          const artist = artists.find(a => a.name === selectedArtist)
          if (!artist) return null
          return (
            <div>
              <button className="back-button" onClick={() => setSelectedArtist(null)}>
                ← Volver a artistas
              </button>
              <h2 className="sub-title">{artist.name}</h2>
              <p className="library-info">{artist.trackCount} canciones</p>
              <TrackList tracks={artist.tracks} />
            </div>
          )
        }
        return (
          <div className="grid-view">
            {artists.map(artist => (
              <div 
                key={artist.name} 
                className="grid-card"
                onClick={() => setSelectedArtist(artist.name)}
              >
                <div className="grid-card-icon">🎤</div>
                <div className="grid-card-title">{artist.name}</div>
                <div className="grid-card-subtitle">{artist.trackCount} canciones</div>
              </div>
            ))}
          </div>
        )

      case 'albums':
        if (selectedAlbum) {
          const album = albums.find(a => `${a.name}||${a.artist}` === selectedAlbum)
          if (!album) return null
          return (
            <div>
              <button className="back-button" onClick={() => setSelectedAlbum(null)}>
                ← Volver a álbumes
              </button>
              <h2 className="sub-title">{album.name}</h2>
              <p className="library-info">{album.artist} · {album.trackCount} canciones</p>
              <TrackList tracks={album.tracks} />
            </div>
          )
        }
        return (
          <div className="grid-view">
            {albums.map(album => (
              <div 
                key={`${album.name}||${album.artist}`} 
                className="grid-card"
                onClick={() => setSelectedAlbum(`${album.name}||${album.artist}`)}
              >
                <div className="grid-card-icon">💿</div>
                <div className="grid-card-title">{album.name}</div>
                <div className="grid-card-subtitle">{album.artist}</div>
              </div>
            ))}
          </div>
        )

      case 'playlists':
        if (playlists.length === 0) {
          return (
            <div className="empty-state">
              <h2>No tienes playlists</h2>
              <p>Crea una playlist desde la barra lateral.</p>
            </div>
          )
        }
        return (
          <div className="grid-view">
            {playlists.map(playlist => (
              <div 
                key={playlist.id} 
                className="grid-card"
                onClick={() => navigate(`/playlist/${playlist.id}`)}
              >
                <div className="grid-card-icon">🎵</div>
                <div className="grid-card-title">{playlist.name}</div>
                <div className="grid-card-subtitle">{playlist.trackIds.length} canciones</div>
              </div>
            ))}
          </div>
        )

      case 'songs':
      default:
        return (
          <>
            <p className="library-info">
              {tracks.length} canciones
            </p>
            <TrackList tracks={tracks} />
          </>
        )
    }
  }

  return (
    <div className="library">
      <h1 className="page-title">Tu Biblioteca</h1>
      
      <div className="view-tabs">
        <button 
          className={`view-tab ${currentView === 'songs' ? 'active' : ''}`}
          onClick={() => setView('songs')}
        >
          Canciones
        </button>
        <button 
          className={`view-tab ${currentView === 'artists' ? 'active' : ''}`}
          onClick={() => setView('artists')}
        >
          Artistas
        </button>
        <button 
          className={`view-tab ${currentView === 'albums' ? 'active' : ''}`}
          onClick={() => setView('albums')}
        >
          Álbumes
        </button>
        <button 
          className={`view-tab ${currentView === 'playlists' ? 'active' : ''}`}
          onClick={() => setView('playlists')}
        >
          Playlists
        </button>
      </div>

      {renderContent()}
    </div>
  )
}
