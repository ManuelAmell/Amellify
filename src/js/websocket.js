class WebSocketManager {
  constructor() {
    this.ws = null;
    this.url = null;
    this.listeners = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 20;
    this.reconnectDelay = 1000;
    this.maxReconnectDelay = 30000;
    this.reconnectTimer = null;
    this.heartbeatInterval = null;
    this.heartbeatTimeout = null;
    this.pendingMessages = [];
    this._isManualClose = false;

    this.state = 'disconnected';
    this._stateListeners = [];
  }

  get isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  onStateChange(callback) {
    this._stateListeners.push(callback);
  }

  _setState(state) {
    this.state = state;
    this._stateListeners.forEach(cb => cb(state));
  }

  connect(url) {
    if (this.ws && this.ws.readyState === WebSocket.CONNECTING) return;

    this.url = url;
    this._isManualClose = false;
    this._createConnection();
  }

  _createConnection() {
    if (this._isManualClose) return;

    this._setState('connecting');

    try {
      this.ws = new WebSocket(this.url);
    } catch (err) {
      this._scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000;
      this._setState('connected');
      this._startHeartbeat();
      this._flushPending();
      this._emit('open', {});
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this._emit(msg.type, msg.data);
      } catch {
        this._emit('raw', { data: event.data });
      }
    };

    this.ws.onclose = () => {
      this._stopHeartbeat();
      this._setState('disconnected');

      if (!this._isManualClose) {
        this._setState('reconnecting');
        this._scheduleReconnect();
      }

      this._emit('close', {});
    };

    this.ws.onerror = () => {
      this._emit('error', {});
    };
  }

  _startHeartbeat() {
    this._stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected) {
        try {
          this.ws.send(JSON.stringify({ type: 'ping', data: { ts: Date.now() } }));
        } catch {}
        this.heartbeatTimeout = setTimeout(() => {
          if (this.ws) {
            this.ws.close();
          }
        }, 10000);
      }
    }, 30000);
  }

  _stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }

  _scheduleReconnect() {
    if (this.reconnectTimer) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this._setState('failed');
      return;
    }

    const delay = Math.min(this.reconnectDelay, this.maxReconnectDelay);
    this.reconnectAttempts++;
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);

    this._emit('reconnecting', { attempt: this.reconnectAttempts, delay });

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this._createConnection();
    }, delay);
  }

  _flushPending() {
    while (this.pendingMessages.length > 0) {
      const msg = this.pendingMessages.shift();
      this._doSend(msg.type, msg.data);
    }
  }

  _doSend(type, data) {
    if (this.isConnected) {
      this.ws.send(JSON.stringify({ type, data }));
    }
  }

  emit(type, data) {
    if (this.isConnected) {
      this._doSend(type, data);
    } else {
      this.pendingMessages.push({ type, data });
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    const callbacks = this.listeners.get(event);
    if (!callbacks) return;
    const idx = callbacks.indexOf(callback);
    if (idx !== -1) callbacks.splice(idx, 1);
  }

  _emit(event, data) {
    const callbacks = this.listeners.get(event);
    if (!callbacks) return;
    for (const cb of callbacks) {
      try { cb(data); } catch (e) { console.error('WS listener error:', e); }
    }
  }

  disconnect() {
    this._isManualClose = true;
    this._stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this._setState('disconnected');
  }

  getState() {
    return this.state;
  }

  getReconnectInfo() {
    return {
      attempt: this.reconnectAttempts,
      delay: this.reconnectDelay,
      state: this.state
    };
  }
}