const BASE_URL = window.location.port === '5173'
  ? 'http://localhost:8000'
  : '';

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
}

export interface DocumentResponse {
  id: string;
  name: string;
  type: string;
  size?: string;
  chunks: number;
  uploaded_at: string;
}

export interface ChatSource {
  reference: string;
  source_file: string;
  source_type: string;
  page_number?: number;
  chunk_id: string;
  relevance_score: number;
}

export interface ChatResponse {
  response: string;
  sources_used: ChatSource[];
}

export interface PodcastScriptResponse {
  total_lines: number;
  estimated_duration: string;
  source_document: string;
  script: Record<string, string>[];
}

class APIClient {
  private getHeaders(contentType: string | null = 'application/json'): Headers {
    const headers = new Headers();
    if (contentType) {
      headers.append('Content-Type', contentType);
    }
    const token = localStorage.getItem('access_token');
    if (token) {
      headers.append('Authorization', `Bearer ${token}`);
    }
    return headers;
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      let errorMsg = 'An error occurred';
      try {
        const errJson = await response.json();
        if (errJson.detail) {
          if (Array.isArray(errJson.detail)) {
            errorMsg = errJson.detail
              .map((err: any) => {
                const field = err.loc && err.loc.length > 0 ? err.loc[err.loc.length - 1] : 'field';
                return `${field}: ${err.msg}`;
              })
              .join(', ');
          } else if (typeof errJson.detail === 'object') {
            errorMsg = JSON.stringify(errJson.detail);
          } else {
            errorMsg = errJson.detail;
          }
        } else {
          errorMsg = errJson.message || errorMsg;
        }
      } catch {
        try {
          errorMsg = await response.text();
        } catch {}
      }
      throw new Error(errorMsg);
    }
    return response.json() as Promise<T>;
  }

  // Authentication
  async register(username: string, email: string, password: string, fullName?: string): Promise<TokenResponse> {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password, full_name: fullName }),
    });
    const tokens = await this.handleResponse<TokenResponse>(res);
    localStorage.setItem('access_token', tokens.access_token);
    localStorage.setItem('refresh_token', tokens.refresh_token);
    return tokens;
  }

  async login(usernameOrEmail: string, password: string): Promise<TokenResponse> {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: usernameOrEmail, password }),
    });
    const tokens = await this.handleResponse<TokenResponse>(res);
    localStorage.setItem('access_token', tokens.access_token);
    localStorage.setItem('refresh_token', tokens.refresh_token);
    return tokens;
  }

  async logout(): Promise<void> {
    try {
      await fetch(`${BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: this.getHeaders(),
      });
    } catch (e) {
      console.error('Logout request failed', e);
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    }
  }

  async verify(): Promise<boolean> {
    const token = localStorage.getItem('access_token');
    if (!token) return false;
    try {
      const res = await fetch(`${BASE_URL}/auth/verify`, {
        method: 'GET',
        headers: this.getHeaders(),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async getProfile(): Promise<{ id: string; username: string; email: string; full_name?: string }> {
    const res = await fetch(`${BASE_URL}/users/me`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    return this.handleResponse(res);
  }

  // Documents
  async listDocuments(): Promise<DocumentResponse[]> {
    const res = await fetch(`${BASE_URL}/documents/`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    return this.handleResponse<DocumentResponse[]>(res);
  }

  async uploadFile(file: File): Promise<DocumentResponse> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${BASE_URL}/documents/upload`, {
      method: 'POST',
      headers: this.getHeaders(null), // fetch will automatically set boundary for multipart
      body: formData,
    });
    return this.handleResponse<DocumentResponse>(res);
  }

  async addUrl(url: string): Promise<DocumentResponse> {
    const formData = new FormData();
    formData.append('url', url);
    const res = await fetch(`${BASE_URL}/documents/url`, {
      method: 'POST',
      headers: this.getHeaders(null),
      body: formData,
    });
    return this.handleResponse<DocumentResponse>(res);
  }

  async addYoutube(url: string): Promise<DocumentResponse> {
    const formData = new FormData();
    formData.append('url', url);
    const res = await fetch(`${BASE_URL}/documents/youtube`, {
      method: 'POST',
      headers: this.getHeaders(null),
      body: formData,
    });
    return this.handleResponse<DocumentResponse>(res);
  }

  async addText(name: string, content: string): Promise<DocumentResponse> {
    const formData = new FormData();
    formData.append('name', name);
    formData.append('content', content);
    const res = await fetch(`${BASE_URL}/documents/text`, {
      method: 'POST',
      headers: this.getHeaders(null),
      body: formData,
    });
    return this.handleResponse<DocumentResponse>(res);
  }

  async getPdfBlob(documentId: string): Promise<Blob> {
    const res = await fetch(`${BASE_URL}/documents/${documentId}/pdf`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      throw new Error('Failed to retrieve PDF file');
    }
    return res.blob();
  }

  async queryChat(query: string): Promise<ChatResponse> {
    const res = await fetch(`${BASE_URL}/chat/`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ query }),
    });
    return this.handleResponse<ChatResponse>(res);
  }

  async queryChatStream(query: string, onChunk: (data: any) => void): Promise<void> {
    const res = await fetch(`${BASE_URL}/chat/stream`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ query }),
    });

    if (!res.ok) {
      let errorMsg = 'An error occurred';
      try {
        const errJson = await res.json();
        errorMsg = errJson.detail || errJson.message || errorMsg;
      } catch {}
      throw new Error(errorMsg);
    }

    const reader = res.body?.getReader();
    if (!reader) {
      throw new Error('Readable stream not supported');
    }

    const decoder = new TextDecoder();
    let partialLine = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunkText = decoder.decode(value, { stream: true });
      const lines = (partialLine + chunkText).split('\n');
      partialLine = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          try {
            const data = JSON.parse(trimmed.slice(6));
            onChunk(data);
          } catch (e) {
            console.error('Failed to parse stream JSON', e, trimmed);
          }
        }
      }
    }
  }

  // Podcast
  async generateScript(sourceName: string, style: string, length: string): Promise<PodcastScriptResponse> {
    const res = await fetch(`${BASE_URL}/podcast/script`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ source_name: sourceName, style, length }),
    });
    return this.handleResponse<PodcastScriptResponse>(res);
  }

  async generateAudio(scriptData: PodcastScriptResponse): Promise<{ filename: string }> {
    const res = await fetch(`${BASE_URL}/podcast/audio`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(scriptData),
    });
    return this.handleResponse<{ filename: string }>(res);
  }

  getAudioUrl(filename: string): string {
    const token = localStorage.getItem('access_token') || '';
    return `${BASE_URL}/podcast/audio/${filename}?token=${token}`;
  }

  async getAudioBlob(filename: string): Promise<Blob> {
    const res = await fetch(`${BASE_URL}/podcast/audio/${filename}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      throw new Error('Failed to retrieve audio file');
    }
    return res.blob();
  }
}

export const api = new APIClient();
