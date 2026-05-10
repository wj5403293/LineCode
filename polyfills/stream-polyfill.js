// Minimal ReadableStream polyfill for React Native
class ReadableStream {
  constructor(underlyingSource = {}) {
    this._queue = [];
    this._closed = false;
    this._errored = null;

    if (underlyingSource.start) {
      const controller = {
        enqueue: (chunk) => this._enqueue(chunk),
        close: () => this._close(),
        error: (err) => this._error(err),
      };
      try {
        underlyingSource.start(controller);
      } catch (e) {
        this._error(e);
      }
    }
  }

  _enqueue(chunk) {
    this._queue.push(chunk);
    if (this._readerResolve) {
      const resolve = this._readerResolve;
      this._readerResolve = null;
      this._readerReject = null;
      resolve({ value: this._queue.shift(), done: false });
    }
  }

  _close() {
    this._closed = true;
    if (this._readerResolve) {
      const resolve = this._readerResolve;
      this._readerResolve = null;
      this._readerReject = null;
      resolve({ value: undefined, done: true });
    }
  }

  _error(err) {
    this._errored = err;
    if (this._readerReject) {
      const reject = this._readerReject;
      this._readerResolve = null;
      this._readerReject = null;
      reject(err);
    }
  }

  getReader() {
    return {
      read: () => {
        return new Promise((resolve, reject) => {
          if (this._queue.length > 0) {
            resolve({ value: this._queue.shift(), done: false });
          } else if (this._closed) {
            resolve({ value: undefined, done: true });
          } else if (this._errored) {
            reject(this._errored);
          } else {
            this._readerResolve = resolve;
            this._readerReject = reject;
          }
        });
      },
      cancel: () => {
        this._closed = true;
        return Promise.resolve();
      },
      releaseLock: () => {},
    };
  }
}

if (typeof globalThis.ReadableStream === 'undefined') {
  globalThis.ReadableStream = ReadableStream;
}

// Ensure TextDecoder exists
if (typeof globalThis.TextDecoder === 'undefined') {
  globalThis.TextDecoder = class TextDecoder {
    constructor(encoding = 'utf-8') {
      this.encoding = encoding;
    }
    decode(buffer) {
      if (!buffer) return '';
      const bytes = new Uint8Array(buffer);
      let result = '';
      for (let i = 0; i < bytes.length; i++) {
        result += String.fromCharCode(bytes[i]);
      }
      try {
        return decodeURIComponent(escape(result));
      } catch {
        return result;
      }
    }
  };
}

// Ensure TextEncoder exists
if (typeof globalThis.TextEncoder === 'undefined') {
  globalThis.TextEncoder = class TextEncoder {
    constructor() {
      this.encoding = 'utf-8';
    }
    encode(str) {
      const utf8 = unescape(encodeURIComponent(str));
      const bytes = new Uint8Array(utf8.length);
      for (let i = 0; i < utf8.length; i++) {
        bytes[i] = utf8.charCodeAt(i);
      }
      return bytes;
    }
  };
}

// Patch fetch to support streaming via XMLHttpRequest
const originalFetch = globalThis.fetch;
globalThis.fetch = async function patchedFetch(url, options = {}) {
  // Check if this is a streaming request
  let isStream = false;
  try {
    const body = options.body ? JSON.parse(options.body) : null;
    isStream = body?.stream === true;
  } catch {}

  if (!isStream) {
    return originalFetch(url, options);
  }

  console.log('[LineAI] Using XHR streaming fetch for:', url);

  // Use XMLHttpRequest for streaming
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(options.method || 'POST', url, true);

    // Set headers
    if (options.headers) {
      const headers = options.headers instanceof Headers
        ? Object.fromEntries(options.headers.entries())
        : options.headers;
      Object.entries(headers).forEach(([key, value]) => {
        xhr.setRequestHeader(key, value);
      });
    }

    const stream = new ReadableStream({
      start(controller) {
        let buffer = '';

        xhr.onprogress = () => {
          const newText = xhr.responseText.substring(buffer.length);
          buffer = xhr.responseText;
          if (newText) {
            // Encode string to Uint8Array
            const encoder = new TextEncoder();
            controller.enqueue(encoder.encode(newText));
          }
        };

        xhr.onload = () => {
          // Process any remaining data
          const remaining = xhr.responseText.substring(buffer.length);
          if (remaining) {
            const encoder = new TextEncoder();
            controller.enqueue(encoder.encode(remaining));
          }
          controller.close();
        };

        xhr.onerror = () => {
          controller.error(new Error('Network error'));
        };

        xhr.ontimeout = () => {
          controller.error(new Error('Timeout'));
        };

        xhr.send(options.body);
      },
    });

    // Create response-like object with body
    const response = {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      body: stream,
      url: url,
      type: 'basic',
      redirected: false,
      clone: () => response,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      blob: () => Promise.resolve(new Blob()),
      formData: () => Promise.resolve(new FormData()),
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(''),
      bytes: () => Promise.resolve(new Uint8Array(0)),
    };

    // Set status from XHR
    xhr.addEventListener('loadstart', () => {
      response.status = xhr.status;
      response.ok = xhr.status >= 200 && xhr.status < 300;
    });

    resolve(response);
  });
};
