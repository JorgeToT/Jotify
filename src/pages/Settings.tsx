import { useState, useEffect } from 'react'
import { Settings as SettingsIcon, Music, ExternalLink, Check, X, Image, Loader, Sparkles, Plus, Folder } from 'lucide-react'
import { useLibraryStore } from '../store/libraryStore'
import './Settings.css'

// Fuentes de imágenes disponibles
const IMAGE_SOURCES = [
  { id: 'waifupics', name: 'Waifu.pics', description: 'Categorías predefinidas de anime' },
  { id: 'safebooru', name: 'Safebooru', description: 'Búsqueda por personajes específicos (tags)' },
  { id: 'nekosbest', name: 'Nekos.best', description: 'Imágenes y GIFs de nekos' },
  { id: 'localfolder', name: 'Carpeta local', description: 'Usa tus propios fondos de pantalla' },
]

// Categorías disponibles de la API waifu.pics
const WAIFU_PICS_CATEGORIES = [
  { id: 'waifu', name: 'Waifu', description: 'Personajes femeninos anime' },
  { id: 'neko', name: 'Neko', description: 'Chicas gato' },
  { id: 'shinobu', name: 'Shinobu', description: 'Shinobu' },
  { id: 'megumin', name: 'Megumin', description: 'Megumin' },
  { id: 'happy', name: 'Happy', description: 'Felicidad' },
  { id: 'smile', name: 'Smile', description: 'Sonrisas' },
  { id: 'wave', name: 'Wave', description: 'Saludos' },
  { id: 'wink', name: 'Wink', description: 'Guiños' },
  { id: 'blush', name: 'Blush', description: 'Sonrojados' },
]

// Categorías de Nekos.best
const NEKOS_BEST_CATEGORIES = [
  { id: 'neko', name: 'Neko', description: 'Chicas gato' },
  { id: 'kitsune', name: 'Kitsune', description: 'Chicas zorro' },
  { id: 'waifu', name: 'Waifu', description: 'Personajes femeninos' },
  { id: 'husbando', name: 'Husbando', description: 'Personajes masculinos' },
]

// Personajes populares sugeridos para Safebooru
const SUGGESTED_CHARACTERS = [
  'hatsune_miku', 'rem_(re:zero)', 'zero_two_(darling_in_the_franxx)',
  'asuna_(sao)', 'nezuko_kamado', 'miku_nakano', 'chika_fujiwara',
  'yor_briar', 'makima_(chainsaw_man)', 'power_(chainsaw_man)',
  'frieren', 'anya_(spy_x_family)', 'ai_hoshino', 'bocchi_gotou',
]

export default function Settings() {
  const [lastfmUsername, setLastfmUsername] = useState<string | null>(null)
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [downloadPath, setDownloadPath] = useState('')
  const [ytDlpInstalled, setYtDlpInstalled] = useState(false)
  const [scrobbleEnabled, setScrobbleEnabled] = useState(true)
  const [isFixingCovers, setIsFixingCovers] = useState(false)
  const [fixCoversResult, setFixCoversResult] = useState<{ fixed: number; failed: number; total: number } | null>(null)
  
  // Anime Visualizer settings
  const [animeCategories, setAnimeCategories] = useState<string[]>(['waifu', 'neko'])
  const [allowGifs, setAllowGifs] = useState(false)
  const [imageSource, setImageSource] = useState<string>('waifupics')
  const [safebooruTags, setSafebooruTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState('')
  const [nekosCategories, setNekosCategories] = useState<string[]>(['neko'])
  const [localFolderPath, setLocalFolderPath] = useState<string>('')
  
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
      
      // Load anime visualizer settings
      if (settings.animeVisualizer) {
        setAnimeCategories(settings.animeVisualizer.categories || ['waifu', 'neko'])
        setAllowGifs(settings.animeVisualizer.allowGifs || false)
        setImageSource(settings.animeVisualizer.imageSource || 'waifupics')
        setSafebooruTags(settings.animeVisualizer.safebooruTags || [])
        setNekosCategories(settings.animeVisualizer.nekosCategories || ['neko'])
        setLocalFolderPath(settings.animeVisualizer.localFolderPath || '')
      }
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

  const handleAnimeCategoryToggle = async (categoryId: string) => {
    const newCategories = animeCategories.includes(categoryId)
      ? animeCategories.filter(c => c !== categoryId)
      : [...animeCategories, categoryId]
    
    // Ensure at least one category is selected
    if (newCategories.length === 0) {
      return
    }
    
    setAnimeCategories(newCategories)
    
    const settings = await window.electron.settings.get()
    await window.electron.settings.save({
      ...settings,
      animeVisualizer: {
        ...settings.animeVisualizer,
        categories: newCategories,
      }
    })
  }

  const handleAllowGifsToggle = async () => {
    const newValue = !allowGifs
    setAllowGifs(newValue)
    
    const settings = await window.electron.settings.get()
    await window.electron.settings.save({
      ...settings,
      animeVisualizer: {
        ...settings.animeVisualizer,
        allowGifs: newValue,
      }
    })
  }

  const handleSelectAllCategories = async () => {
    const allCategories = WAIFU_PICS_CATEGORIES.map(c => c.id)
    setAnimeCategories(allCategories)
    
    const settings = await window.electron.settings.get()
    await window.electron.settings.save({
      ...settings,
      animeVisualizer: {
        ...settings.animeVisualizer,
        categories: allCategories,
      }
    })
  }

  const handleDeselectAllCategories = async () => {
    // Keep at least one category
    const defaultCategory = ['waifu']
    setAnimeCategories(defaultCategory)
    
    const settings = await window.electron.settings.get()
    await window.electron.settings.save({
      ...settings,
      animeVisualizer: {
        ...settings.animeVisualizer,
        categories: defaultCategory,
      }
    })
  }

  const handleImageSourceChange = async (source: string) => {
    setImageSource(source)
    
    const settings = await window.electron.settings.get()
    await window.electron.settings.save({
      ...settings,
      animeVisualizer: {
        ...settings.animeVisualizer,
        imageSource: source,
      }
    })
  }

  const handleSelectLocalFolder = async () => {
    const result = await window.electron.anime.selectLocalFolder()
    if (result.success && result.path) {
      setLocalFolderPath(result.path)
      
      const settings = await window.electron.settings.get()
      await window.electron.settings.save({
        ...settings,
        animeVisualizer: {
          ...settings.animeVisualizer,
          localFolderPath: result.path,
        }
      })
    }
  }

  const handleAddSafebooruTag = async () => {
    const tag = newTag.trim().toLowerCase().replace(/\s+/g, '_')
    if (!tag || safebooruTags.includes(tag)) {
      setNewTag('')
      return
    }
    
    const newTags = [...safebooruTags, tag]
    setSafebooruTags(newTags)
    setNewTag('')
    
    const settings = await window.electron.settings.get()
    await window.electron.settings.save({
      ...settings,
      animeVisualizer: {
        ...settings.animeVisualizer,
        safebooruTags: newTags,
      }
    })
  }

  const handleRemoveSafebooruTag = async (tag: string) => {
    const newTags = safebooruTags.filter(t => t !== tag)
    setSafebooruTags(newTags)
    
    const settings = await window.electron.settings.get()
    await window.electron.settings.save({
      ...settings,
      animeVisualizer: {
        ...settings.animeVisualizer,
        safebooruTags: newTags,
      }
    })
  }

  const handleAddSuggestedCharacter = async (character: string) => {
    if (safebooruTags.includes(character)) return
    
    const newTags = [...safebooruTags, character]
    setSafebooruTags(newTags)
    
    const settings = await window.electron.settings.get()
    await window.electron.settings.save({
      ...settings,
      animeVisualizer: {
        ...settings.animeVisualizer,
        safebooruTags: newTags,
      }
    })
  }

  const handleNekosCategory = async (categoryId: string) => {
    const newCategories = nekosCategories.includes(categoryId)
      ? nekosCategories.filter(c => c !== categoryId)
      : [...nekosCategories, categoryId]
    
    if (newCategories.length === 0) return
    
    setNekosCategories(newCategories)
    
    const settings = await window.electron.settings.get()
    await window.electron.settings.save({
      ...settings,
      animeVisualizer: {
        ...settings.animeVisualizer,
        nekosCategories: newCategories,
      }
    })
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

      {/* Anime Visualizer Section */}
      <section className="settings-section">
        <div className="section-header">
          <h2>
            <Sparkles size={24} />
            Anime Visualizer
          </h2>
          <p className="section-description">
            Configura las imágenes que se muestran en el modo visualizador anime.
          </p>
        </div>

        <div className="setting-item">
          <label>
            <input
              type="checkbox"
              checked={allowGifs}
              onChange={handleAllowGifsToggle}
            />
            <span>Permitir GIFs animados</span>
          </label>
          <p className="setting-help">
            Si está desactivado, solo se mostrarán imágenes estáticas (JPG, PNG, WebP).
          </p>
        </div>

        <div className="setting-item">
          <label>Fuente de imágenes</label>
          <div className="image-source-selector">
            {IMAGE_SOURCES.map(source => (
              <button
                key={source.id}
                className={`source-btn ${imageSource === source.id ? 'active' : ''}`}
                onClick={() => handleImageSourceChange(source.id)}
              >
                <span className="source-name">{source.name}</span>
                <span className="source-desc">{source.description}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Waifu.pics categories */}
        {imageSource === 'waifupics' && (
          <div className="setting-item">
            <label>Categorías de Waifu.pics</label>
            <div className="category-actions">
              <button onClick={handleSelectAllCategories} className="btn-small">
                Seleccionar todas
              </button>
              <button onClick={handleDeselectAllCategories} className="btn-small">
                Deseleccionar todas
              </button>
            </div>
            <div className="anime-categories-grid">
              {WAIFU_PICS_CATEGORIES.map(category => (
                <label 
                  key={category.id} 
                  className={`category-checkbox ${animeCategories.includes(category.id) ? 'selected' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={animeCategories.includes(category.id)}
                    onChange={() => handleAnimeCategoryToggle(category.id)}
                  />
                  <div className="category-info">
                    <span className="category-name">{category.name}</span>
                    <span className="category-desc">{category.description}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Safebooru tags */}
        {imageSource === 'safebooru' && (
          <div className="setting-item">
            <label>Personajes / Tags de Safebooru</label>
            <p className="setting-help" style={{ marginLeft: 0, marginBottom: 12 }}>
              Busca imágenes de personajes específicos. Usa el formato: nombre_apellido o nombre_(serie).
              <br />
              Ejemplos: hatsune_miku, rem_(re:zero), zero_two_(darling_in_the_franxx)
            </p>
            
            <div className="tag-input-container">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddSafebooruTag()}
                placeholder="Escribe un personaje o tag..."
                className="tag-input"
              />
              <button onClick={handleAddSafebooruTag} className="btn-small">
                <Plus size={16} />
                Agregar
              </button>
            </div>

            {safebooruTags.length > 0 && (
              <div className="tags-list">
                {safebooruTags.map(tag => (
                  <span key={tag} className="tag-chip">
                    {tag.replace(/_/g, ' ')}
                    <button onClick={() => handleRemoveSafebooruTag(tag)} className="tag-remove">
                      <X size={14} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="suggested-characters">
              <label>Personajes sugeridos:</label>
              <div className="suggested-list">
                {SUGGESTED_CHARACTERS.filter(c => !safebooruTags.includes(c)).slice(0, 8).map(character => (
                  <button
                    key={character}
                    className="suggested-chip"
                    onClick={() => handleAddSuggestedCharacter(character)}
                  >
                    <Plus size={12} />
                    {character.replace(/_/g, ' ').replace(/\(.*?\)/g, '').trim()}
                  </button>
                ))}
              </div>
            </div>

            <div className="info-box" style={{ marginTop: 16 }}>
              <p><strong>💡 Tip:</strong> Puedes buscar cualquier personaje en <button 
                onClick={() => window.electron.openExternal('https://safebooru.org/index.php?page=tags&s=list')}
                className="link-button"
                style={{ display: 'inline' }}
              >
                Safebooru Tags
                <ExternalLink size={12} />
              </button> y copiar el tag exacto.</p>
            </div>
          </div>
        )}

        {/* Nekos.best categories */}
        {imageSource === 'nekosbest' && (
          <div className="setting-item">
            <label>Categorías de Nekos.best</label>
            <div className="anime-categories-grid">
              {NEKOS_BEST_CATEGORIES.map(category => (
                <label 
                  key={category.id} 
                  className={`category-checkbox ${nekosCategories.includes(category.id) ? 'selected' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={nekosCategories.includes(category.id)}
                    onChange={() => handleNekosCategory(category.id)}
                  />
                  <div className="category-info">
                    <span className="category-name">{category.name}</span>
                    <span className="category-desc">{category.description}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Local folder */}
        {imageSource === 'localfolder' && (
          <div className="setting-item">
            <label>Carpeta de fondos de pantalla</label>
            <p className="setting-help">
              Selecciona una carpeta con tus imágenes favoritas (JPG, PNG, WebP, GIF).
            </p>
            <div className="folder-selector">
              <input 
                type="text" 
                value={localFolderPath} 
                readOnly 
                placeholder="Ninguna carpeta seleccionada"
                className="folder-path-input"
              />
              <button onClick={handleSelectLocalFolder} className="btn-folder">
                <Folder size={18} />
                Seleccionar carpeta
              </button>
            </div>
            {localFolderPath && (
              <p className="setting-help success">
                ✓ Carpeta configurada. Las imágenes se cargarán desde esta ubicación.
              </p>
            )}
          </div>
        )}

        <div className="info-box">
          <p><strong>ℹ️ Sobre las fuentes</strong></p>
          <ul>
            <li><strong>Waifu.pics:</strong> Imágenes curadas por categoría, calidad consistente.</li>
            <li><strong>Safebooru:</strong> Búsqueda por personaje específico, gran variedad.</li>
            <li><strong>Nekos.best:</strong> Enfocado en nekos y waifus, incluye GIFs.</li>
            <li><strong>Carpeta local:</strong> Usa tus propios fondos de pantalla.</li>
          </ul>
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
