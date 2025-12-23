import { useState, useEffect } from 'react'
import { Settings as SettingsIcon, Music, ExternalLink, Check, X, Image, Loader } from 'lucide-react'
import { useLibraryStore } from '../store/libraryStore'
import './Settings.css'

export default function Settings() {
  const [lastfmUsername, setLastfmUsername] = useState<string | null>(null)
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [downloadPath, setDownloadPath] = useState('')
  const [ytDlpInstalled, setYtDlpInstalled] = useState(false)
  const [scrobbleEnabled, setScrobbleEnabled] = useState(true)
  const [isFixingCovers, setIsFixingCovers] = useState(false)
  const [fixCoversResult, setFixCoversResult] = useState<{ fixed: number; failed: number; total: number } | null>(null)
  
  const { loadTracks } = useLibraryStore()

  useEffect(() => {
    loadSettings()
    checkYtDlp()
  }, [])

  const loadSettings = async () => {
    try {
      const isAuth = await window.electron.lastfm.isAuthenticated()
      if (isAuth) {
        const username = await window.electron.lastfm.getUsername()
        setLastfmUsername(username || null)
      }

      const settings = await window.electron.settings.get()
      setDownloadPath(settings.downloadPath || '')
      setScrobbleEnabled(settings.lastfm?.scrobbleEnabled !== false)
    } catch (error) {
      console.error('Error loading settings:', error)
    }
  }

  const checkYtDlp = async () => {
    const installed = await window.electron.download.checkYtDlp()
    setYtDlpInstalled(installed)
  }

  const handleLastfmAuth = async () => {
    try {
      setIsAuthenticating(true)
      const authUrl = await window.electron.lastfm.getAuthUrl()
      
      // Open Last.fm auth page
      await window.electron.openExternal(authUrl)
      
      // Wait for user to authorize and enter token
      const token = prompt(
        'Autoriza la aplicación en Last.fm y luego pega el token de la URL (el parámetro "token=" después de autorizar):'
      )
      
      if (token) {
        const result = await window.electron.lastfm.authenticate(token)
        if (result.success) {
          setLastfmUsername(result.username || null)
          alert(`¡Conectado exitosamente como ${result.username}!`)
        } else {
          alert(`Error: ${result.error}`)
        }
      }
    } catch (error) {
      console.error('Error authenticating:', error)
      alert('Error al autenticar con Last.fm')
    } finally {
      setIsAuthenticating(false)
    }
  }

  const handleLastfmDisconnect = async () => {
    if (confirm('¿Desconectar de Last.fm?')) {
      await window.electron.lastfm.disconnect()
      setLastfmUsername(null)
    }
  }

  const handleSelectDownloadPath = async () => {
    const path = await window.electron.download.selectOutputPath()
    if (path) {
      setDownloadPath(path)
    }
  }

  const handleScrobbleToggle = async () => {
    const newValue = !scrobbleEnabled
    setScrobbleEnabled(newValue)
    
    const settings = await window.electron.settings.get()
    await window.electron.settings.save({
      ...settings,
      lastfm: {
        ...settings.lastfm,
        scrobbleEnabled: newValue,
      }
    })
  }

  const handleFixCovers = async () => {
    setIsFixingCovers(true)
    setFixCoversResult(null)
    
    try {
      const result = await window.electron.fixCovers()
      if (result.success) {
        setFixCoversResult({
          fixed: result.fixed || 0,
          failed: result.failed || 0,
          total: result.total || 0
        })
        
        // Recargar la biblioteca para mostrar los nuevos covers
        if (result.fixed && result.fixed > 0) {
          await loadTracks()
        }
      } else {
        alert(`Error: ${result.error}`)
      }
    } catch (error) {
      console.error('Error fixing covers:', error)
      alert('Error al arreglar covers')
    } finally {
      setIsFixingCovers(false)
    }
  }

  return (
    <div className="settings">
      <h1 className="page-title">
        <SettingsIcon size={32} />
        Configuración
      </h1>

      {/* Last.fm Section */}
      <section className="settings-section">
        <div className="section-header">
          <h2>Last.fm</h2>
          <p className="section-description">
            Conecta tu cuenta de Last.fm para hacer scrobbling automático de las canciones que escuchas
            y obtener metadata adicional.
          </p>
        </div>

        {lastfmUsername ? (
          <div className="lastfm-connected">
            <div className="connection-status">
              <Check size={24} className="status-icon success" />
              <div>
                <div className="status-title">Conectado como</div>
                <div className="status-username">{lastfmUsername}</div>
              </div>
            </div>

            <div className="setting-item">
              <label>
                <input
                  type="checkbox"
                  checked={scrobbleEnabled}
                  onChange={handleScrobbleToggle}
                />
                <span>Hacer scrobbling automático</span>
              </label>
              <p className="setting-help">
                Las canciones se enviarán a Last.fm automáticamente cuando las escuches por más de 30 segundos.
              </p>
            </div>

            <button onClick={handleLastfmDisconnect} className="btn-secondary">
              Desconectar de Last.fm
            </button>
          </div>
        ) : (
          <div className="lastfm-disconnected">
            <div className="connection-status">
              <X size={24} className="status-icon error" />
              <div>
                <div className="status-title">No conectado</div>
              </div>
            </div>

            <button 
              onClick={handleLastfmAuth} 
              className="btn-primary"
              disabled={isAuthenticating}
            >
              {isAuthenticating ? 'Autenticando...' : 'Conectar con Last.fm'}
              <ExternalLink size={16} />
            </button>

            <div className="info-box">
              <p><strong>¿Qué es Last.fm?</strong></p>
              <p>
                Last.fm es un servicio que registra tu historial de música (scrobbling) y te ayuda a 
                descubrir nueva música basada en tus gustos. También proporciona estadísticas detalladas 
                de tu escucha musical.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Download Section */}
      <section className="settings-section">
        <div className="section-header">
          <h2>
            <Music size={24} />
            Descargas
          </h2>
          <p className="section-description">
            Configura dónde se guardarán las canciones descargadas desde YouTube/YouTube Music.
          </p>
        </div>

        <div className="setting-item">
          <label>Carpeta de descargas</label>
          <div className="path-selector">
            <input
              type="text"
              value={downloadPath || 'No seleccionada'}
              readOnly
              className="path-input"
            />
            <button onClick={handleSelectDownloadPath} className="btn-secondary">
              Seleccionar
            </button>
          </div>
        </div>

        <div className="setting-item">
          <label>Estado de yt-dlp</label>
          <div className="status-indicator">
            {ytDlpInstalled ? (
              <>
                <Check size={20} className="status-icon success" />
                <span className="status-text success">Instalado</span>
              </>
            ) : (
              <>
                <X size={20} className="status-icon error" />
                <span className="status-text error">No instalado</span>
              </>
            )}
          </div>
          {!ytDlpInstalled && (
            <div className="warning-box">
              <p><strong>⚠️ yt-dlp no está instalado</strong></p>
              <p>
                Para descargar música, necesitas instalar yt-dlp:
              </p>
              <code>winget install yt-dlp</code>
              <p>o descárgalo desde:</p>
              <button 
                onClick={() => window.electron.openExternal('https://github.com/yt-dlp/yt-dlp')}
                className="link-button"
              >
                https://github.com/yt-dlp/yt-dlp
                <ExternalLink size={14} />
              </button>
            </div>
          )}
        </div>

        <div className="info-box">
          <p><strong>ℹ️ Sobre la calidad de audio</strong></p>
          <p>
            YouTube NO ofrece archivos FLAC nativos. La mejor calidad disponible es:
          </p>
          <ul>
            <li><strong>OPUS</strong>: ~160 kbps VBR (mejor opción para YouTube)</li>
            <li><strong>M4A/AAC</strong>: ~256 kbps (YouTube Music premium)</li>
            <li><strong>FLAC</strong>: Conversión lossless (no mejora la calidad original)</li>
          </ul>
          <p>
            Recomendamos descargar en <strong>OPUS</strong> o <strong>M4A</strong> para mantener 
            la calidad original sin conversiones innecesarias.
          </p>
        </div>
      </section>

      {/* Cover Art Section */}
      <section className="settings-section">
        <div className="section-header">
          <h2>
            <Image size={24} />
            Carátulas de Álbumes
          </h2>
          <p className="section-description">
            Busca y descarga carátulas faltantes desde Cover Art Archive (MusicBrainz).
          </p>
        </div>

        <div className="setting-item">
          <button 
            onClick={handleFixCovers} 
            className="btn-primary"
            disabled={isFixingCovers}
          >
            {isFixingCovers ? (
              <>
                <Loader size={16} className="spinning" />
                Buscando carátulas...
              </>
            ) : (
              <>
                <Image size={16} />
                Buscar y descargar carátulas faltantes
              </>
            )}
          </button>
          
          {isFixingCovers && (
            <p className="setting-help">
              Este proceso puede tardar varios minutos. Las carátulas se buscan en Cover Art Archive.
            </p>
          )}

          {fixCoversResult && (
            <div className="info-box success">
              <p><strong>✅ Proceso completado</strong></p>
              <ul>
                <li>Tracks analizados: {fixCoversResult.total}</li>
                <li>Carátulas encontradas: {fixCoversResult.fixed}</li>
                <li>No encontradas: {fixCoversResult.failed}</li>
              </ul>
              <p>Recarga la biblioteca para ver los cambios.</p>
            </div>
          )}
        </div>

        <div className="info-box">
          <p><strong>ℹ️ Sobre las carátulas</strong></p>
          <p>
            Las carátulas se buscan en <strong>Cover Art Archive</strong>, la base de datos de 
            carátulas de MusicBrainz. Si una canción no tiene carátula disponible, se mostrará 
            una imagen de anime como fallback.
          </p>
        </div>
      </section>

      {/* API Keys Info */}
      <section className="settings-section">
        <div className="section-header">
          <h2>🔑 API Keys</h2>
          <p className="section-description">
            Para usar Last.fm, necesitas configurar tus API keys en el código.
          </p>
        </div>

        <div className="info-box">
          <p><strong>Configura tus credenciales de Last.fm:</strong></p>
          <ol>
            <li>
              Crea una aplicación en{' '}
              <button 
                onClick={() => window.electron.openExternal('https://www.last.fm/api/account/create')}
                className="link-button"
              >
                Last.fm API
                <ExternalLink size={14} />
              </button>
            </li>
            <li>Obtén tu <strong>API Key</strong> y <strong>Shared Secret</strong></li>
            <li>
              Edita el archivo <code>electron/main.ts</code> y reemplaza:
              <pre>
{`const LASTFM_API_KEY = 'TU_API_KEY_AQUI'
const LASTFM_API_SECRET = 'TU_API_SECRET_AQUI'`}
              </pre>
            </li>
            <li>Reinicia la aplicación</li>
          </ol>
        </div>
      </section>
    </div>
  )
}
