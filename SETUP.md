# 🚀 Guía Rápida de Configuración - Jotify

## Pasos para empezar

### 1. Instalar dependencias
```powershell
npm install
```

### 2. Configurar Last.fm (Opcional pero recomendado)

#### Obtener API Keys:
1. Ve a https://www.last.fm/api/account/create
2. Nombre de la aplicación: "Jotify"
3. Descripción: "Personal HiFi Music Player"
4. Callback URL: (deja en blanco)
5. Click en "Submit"

#### Configurar en la app:
1. Abre `electron/main.ts`
2. Busca las líneas:
   ```typescript
   const LASTFM_API_KEY = 'TU_API_KEY_AQUI'
   const LASTFM_API_SECRET = 'TU_API_SECRET_AQUI'
   ```
3. Reemplaza con tus credenciales de Last.fm
4. Guarda el archivo

### 3. Instalar yt-dlp (Para descargar música)

#### Windows:
```powershell
# Opción 1: winget (recomendado)
winget install yt-dlp

# Opción 2: scoop
scoop install yt-dlp

# Opción 3: chocolatey
choco install yt-dlp
```

#### Verificar instalación:
```powershell
yt-dlp --version
```

Si ves un número de versión, ¡está instalado correctamente!

### 4. Instalar FFmpeg (Opcional pero recomendado)

FFmpeg es necesario para convertir audio a diferentes formatos.

```powershell
# Windows
winget install FFmpeg

# Verificar
ffmpeg -version
```

### 5. Iniciar la aplicación

```powershell
npm run dev
```

La aplicación se abrirá automáticamente en modo desarrollo.

## ✅ Checklist de Configuración

- [ ] Dependencias npm instaladas
- [ ] API Keys de Last.fm configuradas en `electron/main.ts`
- [ ] yt-dlp instalado y funcionando
- [ ] FFmpeg instalado (opcional)
- [ ] Aplicación iniciada con `npm run dev`

## 🎵 Primeros Pasos en la App

1. **Escanear tu música**:
   - Click en "Escanear música" en la barra lateral
   - Selecciona la carpeta con tus archivos FLAC
   - Espera a que termine el escaneo

2. **Conectar Last.fm**:
   - Ve a Configuración (⚙️ en la barra lateral)
   - Click en "Conectar con Last.fm"
   - Autoriza en el navegador
   - Copia el token y pégalo en la app

3. **Empezar a escuchar**:
   - Ve a "Tu Biblioteca"
   - Haz doble click en una canción
   - ¡Disfruta tu música en HiFi!

4. **Descargar música** (opcional):
   - Ve a "Descargar" en la barra lateral
   - Busca una canción en YouTube
   - Selecciona formato (OPUS recomendado)
   - Click en "Descargar"

## ⚠️ Solución de Problemas

### yt-dlp no se encuentra
```powershell
# Verifica que esté en el PATH
where.exe yt-dlp

# Si no está, reinicia PowerShell después de la instalación
```

### Error al conectar Last.fm
- Verifica que hayas configurado correctamente las API Keys
- Asegúrate de haber reiniciado la app después de configurar
- El token de Last.fm expira rápido, obtén uno nuevo si falla

### No se pueden reproducir archivos FLAC
- Verifica que los archivos estén en la carpeta escaneada
- Asegúrate de que los archivos no estén corruptos
- Intenta escanear de nuevo la biblioteca

### Descargas lentas o que fallan
- Verifica tu conexión a internet
- Algunos videos de YouTube pueden tener restricciones
- Prueba con otro video/canción

## 📚 Recursos

- **Last.fm API**: https://www.last.fm/api
- **yt-dlp**: https://github.com/yt-dlp/yt-dlp
- **FFmpeg**: https://ffmpeg.org/

## 💡 Tips

- **Mejor calidad de descarga**: Usa formato OPUS para YouTube (es el nativo, máxima calidad)
- **Scrobbling**: Se activa automáticamente cuando escuchas 50% de una canción
- **Atajos**: Doble click en una canción para reproducirla
- **Playlists**: Crea playlists para organizar tu música
- **Búsqueda**: Usa la búsqueda local para encontrar canciones rápidamente

---

¿Listo? ¡Ejecuta `npm run dev` y empieza a disfrutar tu música! 🎶
