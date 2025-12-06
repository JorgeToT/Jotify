import crypto from 'crypto'
import fetch from 'node-fetch'

interface LastFmConfig {
  apiKey: string
  apiSecret: string
  sessionKey?: string
  username?: string
}

interface ScrobbleTrack {
  artist: string
  track: string
  timestamp: number
  album?: string
  albumArtist?: string
  duration?: number
}

interface TrackInfo {
  name: string
  artist: string
  album?: string
  duration?: number
  playcount?: number
  listeners?: number
  tags?: string[]
  wiki?: string
  mbid?: string
  imageUrl?: string
}

export class LastFmService {
  private config: LastFmConfig
  private readonly API_URL = 'https://ws.audioscrobbler.com/2.0/'
  private readonly AUTH_URL = 'https://www.last.fm/api/auth/'

  constructor(apiKey: string, apiSecret: string) {
    this.config = {
      apiKey,
      apiSecret,
    }
  }

  // Generate API signature for authenticated calls
  private generateSignature(params: Record<string, string | number>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}${params[key]}`)
      .join('')
    
    return crypto
      .createHash('md5')
      .update(sortedParams + this.config.apiSecret)
      .digest('hex')
  }

  // Get authentication URL for user
  getAuthUrl(): string {
    return `${this.AUTH_URL}?api_key=${this.config.apiKey}`
  }

  // Get session key after user authorizes
  async getSessionKey(token: string): Promise<{ sessionKey: string; username: string }> {
    const params = {
      method: 'auth.getSession',
      api_key: this.config.apiKey,
      token,
    }

    const signature = this.generateSignature(params)

    const url = new URL(this.API_URL)
    url.searchParams.append('method', 'auth.getSession')
    url.searchParams.append('api_key', this.config.apiKey)
    url.searchParams.append('token', token)
    url.searchParams.append('api_sig', signature)
    url.searchParams.append('format', 'json')

    const response = await fetch(url.toString())
    const data = await response.json() as any

    if (data.error) {
      throw new Error(data.message || 'Failed to get session')
    }

    this.config.sessionKey = data.session.key
    this.config.username = data.session.name

    return {
      sessionKey: data.session.key,
      username: data.session.name,
    }
  }

  // Set session key (when loading from storage)
  setSession(sessionKey: string, username: string) {
    this.config.sessionKey = sessionKey
    this.config.username = username
  }

  // Update "Now Playing" status
  async updateNowPlaying(track: ScrobbleTrack): Promise<boolean> {
    if (!this.config.sessionKey) {
      throw new Error('Not authenticated')
    }

    const params: Record<string, string | number> = {
      method: 'track.updateNowPlaying',
      api_key: this.config.apiKey,
      sk: this.config.sessionKey,
      artist: track.artist,
      track: track.track,
    }

    if (track.album) params.album = track.album
    if (track.albumArtist) params.albumArtist = track.albumArtist
    if (track.duration) params.duration = Math.floor(track.duration)

    const signature = this.generateSignature(params)

    const formData = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      formData.append(key, value.toString())
    })
    formData.append('api_sig', signature)
    formData.append('format', 'json')

    const response = await fetch(this.API_URL, {
      method: 'POST',
      body: formData,
    })

    const data = await response.json() as any
    return !data.error
  }

  // Scrobble a track
  async scrobble(track: ScrobbleTrack): Promise<boolean> {
    if (!this.config.sessionKey) {
      throw new Error('Not authenticated')
    }

    const params: Record<string, string | number> = {
      method: 'track.scrobble',
      api_key: this.config.apiKey,
      sk: this.config.sessionKey,
      artist: track.artist,
      track: track.track,
      timestamp: Math.floor(track.timestamp / 1000),
    }

    if (track.album) params.album = track.album
    if (track.albumArtist) params.albumArtist = track.albumArtist
    if (track.duration) params.duration = Math.floor(track.duration)

    const signature = this.generateSignature(params)

    const formData = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      formData.append(key, value.toString())
    })
    formData.append('api_sig', signature)
    formData.append('format', 'json')

    const response = await fetch(this.API_URL, {
      method: 'POST',
      body: formData,
    })

    const data = await response.json() as any
    return !data.error
  }

  // Get track info from Last.fm
  async getTrackInfo(artist: string, track: string, album?: string): Promise<TrackInfo | null> {
    const params: Record<string, string> = {
      method: 'track.getInfo',
      api_key: this.config.apiKey,
      artist,
      track,
    }

    if (album) params.album = album

    const url = new URL(this.API_URL)
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value)
    })
    url.searchParams.append('format', 'json')

    try {
      const response = await fetch(url.toString())
      const data = await response.json() as any

      if (data.error || !data.track) {
        return null
      }

      const trackData = data.track

      return {
        name: trackData.name,
        artist: trackData.artist?.name || artist,
        album: trackData.album?.title,
        duration: trackData.duration ? parseInt(trackData.duration) : undefined,
        playcount: trackData.playcount ? parseInt(trackData.playcount) : undefined,
        listeners: trackData.listeners ? parseInt(trackData.listeners) : undefined,
        tags: trackData.toptags?.tag?.map((t: any) => t.name) || [],
        wiki: trackData.wiki?.summary,
        mbid: trackData.mbid,
        imageUrl: trackData.album?.image?.find((img: any) => img.size === 'large')?.['#text'],
      }
    } catch (error) {
      console.error('Error fetching track info:', error)
      return null
    }
  }

  // Search for similar tracks
  async getSimilarTracks(artist: string, track: string, limit = 10): Promise<TrackInfo[]> {
    const params: Record<string, string | number> = {
      method: 'track.getSimilar',
      api_key: this.config.apiKey,
      artist,
      track,
      limit,
    }

    const url = new URL(this.API_URL)
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value.toString())
    })
    url.searchParams.append('format', 'json')

    try {
      const response = await fetch(url.toString())
      const data = await response.json() as any

      if (data.error || !data.similartracks?.track) {
        return []
      }

      return data.similartracks.track.map((t: any) => ({
        name: t.name,
        artist: t.artist?.name || '',
        mbid: t.mbid,
        imageUrl: t.image?.find((img: any) => img.size === 'large')?.['#text'],
      }))
    } catch (error) {
      console.error('Error fetching similar tracks:', error)
      return []
    }
  }

  // Get user's recent tracks
  async getRecentTracks(limit = 50): Promise<any[]> {
    if (!this.config.username) {
      throw new Error('No username set')
    }

    const params: Record<string, string | number> = {
      method: 'user.getRecentTracks',
      api_key: this.config.apiKey,
      user: this.config.username,
      limit,
    }

    const url = new URL(this.API_URL)
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value.toString())
    })
    url.searchParams.append('format', 'json')

    try {
      const response = await fetch(url.toString())
      const data = await response.json() as any

      if (data.error || !data.recenttracks?.track) {
        return []
      }

      return data.recenttracks.track
    } catch (error) {
      console.error('Error fetching recent tracks:', error)
      return []
    }
  }

  isAuthenticated(): boolean {
    return !!this.config.sessionKey
  }

  getUsername(): string | undefined {
    return this.config.username
  }
}
