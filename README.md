# Jotify - HiFi Music Player

Un reproductor de música local tipo Spotify/YouTube Music optimizado para archivos FLAC de alta calidad con integración de Last.fm y descarga de música desde YouTube.

## 🎵 Características Principales

### ✅ **Reproductor de Audio FLAC**
- Reproducción de archivos FLAC sin pérdida de calidad
- También soporta WAV, APE, ALAC, AIFF
- Control de reproducción completo (play/pause, siguiente, anterior)
- Barra de progreso y control de volumen
- Modo repetir (off/all/one) y aleatorio

### ✅ **Biblioteca Musical**
- Escaneo automático de carpetas
- Extracción de metadata completa (título, artista, álbum, año, género)
- Muestra información de calidad (sample rate, bit depth, bitrate)
- Carátulas de álbumes
- Base de datos SQLite local

### ✅ **Gestión de Playlists**
- Crear playlists personalizadas
- Agregar/eliminar canciones
- Renombrar y eliminar playlists
- Persistencia en base de datos

### ✅ **Integración con Last.fm**
- **Scrobbling automático**: Las canciones se envían a Last.fm cuando las escuchas
- **Now Playing**: Actualiza tu estado actual en Last.fm
- **Metadata enriquecida**: Obtén información adicional de tus canciones
- **Tracks similares**: Descubre música relacionada
- **Historial**: Ve tu historial de reproducción

### ✅ **Descarga de Música**
- Busca música en YouTube/YouTube Music
- Descarga en múltiples formatos:
  - **OPUS**: ~160 kbps VBR (recomendado para YouTube)
  - **M4A/AAC**: ~256 kbps (YouTube Music)
  - **FLAC**: Conversión lossless
- Metadata automática incluida
- Las canciones se agregan automáticamente a tu biblioteca

### ✅ **Interfaz Tipo Spotify**
- Diseño oscuro moderno
- Sidebar con navegación
- Página de inicio con estadísticas
- Búsqueda en tiempo real
- Lista de reproducción visual con información de calidad HiFi

## 📦 Instalación

```bash
cd "c:\Users\Jorge\Jotify"

# Instalar dependencias
npm install
```

## 🔑 Configuración de Last.fm

Para usar Last.fm, necesitas crear una cuenta de API:

1. Ve a [Last.fm API Account](https://www.last.fm/api/account/create)
2. Crea una nueva aplicación
3. Obtén tu **API Key** y **Shared Secret**
4. Edita `electron/main.ts` y reemplaza:
   ```typescript
   const LASTFM_API_KEY = 'TU_API_KEY_AQUI'
   const LASTFM_API_SECRET = 'TU_API_SECRET_AQUI'
   ```
5. Reinicia la aplicación

## 🎧 Configuración de yt-dlp

Para descargar música desde YouTube, necesitas instalar yt-dlp:

### En Windows:
```powershell
# Usando winget
winget install yt-dlp

# O usando scoop
scoop install yt-dlp

# O usando chocolatey
choco install yt-dlp
```

### En macOS:
```bash
brew install yt-dlp
```

### En Linux:
```bash
# Ubuntu/Debian
sudo apt install yt-dlp

# O descarga el binario
sudo wget https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -O /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp
```

**Opcional pero recomendado**: Instala FFmpeg para conversión de audio
```bash
# Windows
winget install FFmpeg

# macOS
brew install ffmpeg

# Linux
sudo apt install ffmpeg
```

## 🛠️ Desarrollo

```bash
npm run dev
```

Esto iniciará:
- Vite dev server en `http://localhost:5173`
- Electron en modo desarrollo

## 📦 Build

```bash
# Build para Windows
npm run build:win

# Build general
npm run build
```

## 🎯 Cómo Usar

### Primera Configuración

1. **Escanear Biblioteca**:
   - Click en "Escanear música" en la barra lateral
   - Selecciona tu carpeta con archivos FLAC
   - La app escaneará automáticamente y extraerá metadata

2. **Conectar Last.fm** (opcional):
   - Ve a **Configuración** → **Last.fm**
   - Click en "Conectar con Last.fm"
   - Autoriza la aplicación en el navegador
   - Copia el token de la URL y pégalo cuando se te solicite

3. **Configurar Descargas** (opcional):
   - Ve a **Configuración** → **Descargas**
   - Selecciona la carpeta donde quieres guardar las descargas
   - Verifica que yt-dlp esté instalado

### Uso Diario

1. **Reproducir Música**:
   - Navega a **Tu Biblioteca**
   - Haz doble click en cualquier canción para reproducirla
   - Usa los controles del reproductor en la parte inferior

2. **Crear Playlists**:
   - Click en "Crear playlist" en la barra lateral
   - Agrega canciones desde tu biblioteca

3. **Buscar Música**:
   - Ve a **Buscar** para buscar en tu biblioteca local
   - O ve a **Descargar** para buscar en YouTube

4. **Descargar desde YouTube**:
   - Ve a **Descargar**
   - Busca la canción que quieres
   - Selecciona el formato (OPUS recomendado)
   - Click en "Descargar"
   - La canción se agregará automáticamente a tu biblioteca

## ℹ️ Información Importante

### Sobre la Calidad de Audio

**YouTube NO ofrece FLAC nativo**. Los formatos disponibles son:

- **OPUS** (~160 kbps VBR): Es el formato nativo de YouTube para audio de alta calidad. **Recomendado** porque mantiene la mejor calidad sin conversiones.

- **M4A/AAC** (~256 kbps): Disponible en YouTube Music Premium. Buena calidad, formato ampliamente compatible.

- **FLAC** (Lossless): Jotify puede convertir a FLAC, pero esto NO mejora la calidad del audio original de YouTube. Solo cambia el contenedor a formato lossless.

**Recomendación**: Descarga en OPUS o M4A para mantener la calidad original sin conversiones innecesarias.

### Scrobbling de Last.fm

El scrobbling automático funciona así:
- **Now Playing** se actualiza después de 1 segundo de reproducción
- **Scrobble** se envía después de:
  - 50% de la canción reproducida, O
  - 240 segundos (4 minutos), lo que ocurra primero

Puedes desactivar el scrobbling en **Configuración** → **Last.fm**.

## 🔧 Tecnologías

- **Electron**: Framework para aplicación de escritorio
- **React**: UI library
- **TypeScript**: Type safety
- **Vite**: Build tool
- **SQLite**: Base de datos local
- **music-metadata**: Extracción de metadata de audio
- **Last.fm API**: Scrobbling y metadata
- **yt-dlp**: Descarga de música desde YouTube

## 📝 Licencia

MIT
