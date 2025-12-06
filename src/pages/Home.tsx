import { useLibraryStore } from '../store/libraryStore'
import './Home.css'

export default function Home() {
  const { tracks, playlists } = useLibraryStore()

  const recentTracks = tracks.slice(0, 10)

  return (
    <div className="home">
      <h1 className="page-title">Inicio</h1>

      <section className="home-section">
        <h2 className="section-title">Bienvenido a Jotify</h2>
        <p className="section-description">
          Tu reproductor de música HiFi para archivos FLAC. Disfruta de audio sin pérdidas con calidad de estudio.
        </p>

        <div className="stats">
          <div className="stat-card">
            <div className="stat-number">{tracks.length}</div>
            <div className="stat-label">Canciones</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{playlists.length}</div>
            <div className="stat-label">Playlists</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">
              {new Set(tracks.map(t => t.artist)).size}
            </div>
            <div className="stat-label">Artistas</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">
              {new Set(tracks.map(t => t.album)).size}
            </div>
            <div className="stat-label">Álbumes</div>
          </div>
        </div>
      </section>

      {recentTracks.length > 0 && (
        <section className="home-section">
          <h2 className="section-title">Agregadas recientemente</h2>
          <div className="recent-tracks">
            {recentTracks.map((track) => (
              <div key={track.id} className="track-card">
                {track.coverArt && (
                  <img src={track.coverArt} alt={track.album} className="track-card-cover" />
                )}
                <div className="track-card-info">
                  <div className="track-card-title">{track.title}</div>
                  <div className="track-card-artist">{track.artist}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
