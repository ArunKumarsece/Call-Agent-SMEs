/**
 * Widget SDK — Call Recording & Analytics Integration
 * Integrates with VoiceCallWidget and LiveAudioService to record calls
 * 
 * Usage in widget:
 *   const sdk = new CallRecordingSDK(agentId, userEmail);
 *   await sdk.startSession();
 *   // ... call happens ...
 *   await sdk.endSession();
 *   const analysis = await sdk.getAnalysis();
 */

export class CallRecordingSDK {
  constructor(agentId, callerId = null, apiBase = '') {
    this.agentId = agentId;
    this.callerId = callerId;
    this.apiBase = apiBase || 'http://localhost:8000';
    this.sessionId = null;
    this.isRecording = false;
    this.callbacks = {};
  }

  /**
   * Start a new recording session
   */
  async startSession() {
    try {
      const res = await fetch(`${this.apiBase}/api/calls/session/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_id: this.agentId,
          caller_id: this.callerId,
        }),
      });

      if (!res.ok) {
        throw new Error(`Failed to start session: ${res.statusText}`);
      }

      const data = await res.json();
      this.sessionId = data.session_id;
      this.isRecording = true;

      console.log(`[SDK] Recording started: ${this.sessionId}`);
      this.emit('onSessionStart', { sessionId: this.sessionId });
      return this.sessionId;
    } catch (e) {
      console.error('[SDK] Error starting session:', e);
      this.emit('onError', e);
      throw e;
    }
  }

  /**
   * Add transcript chunk (called during call)
   */
  async addTranscript(role, text, timestampMs = null) {
    if (!this.sessionId || !this.isRecording) return;

    try {
      const res = await fetch(`${this.apiBase}/api/calls/${this.sessionId}/transcript`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: this.sessionId,
          role,
          text,
          timestamp_ms: timestampMs,
        }),
      });

      if (!res.ok) {
        console.warn(`[SDK] Failed to record transcript: ${res.statusText}`);
      }
    } catch (e) {
      console.warn('[SDK] Error recording transcript:', e);
    }
  }

  /**
   * Add audio chunk (called during call)
   * Expects raw PCM 16-bit audio
   */
  async addAudio(pcmI16Bytes) {
    if (!this.sessionId || !this.isRecording) return;

    try {
      // Convert to base64
      const b64 = btoa(String.fromCharCode.apply(null, pcmI16Bytes));

      const res = await fetch(`${this.apiBase}/api/calls/${this.sessionId}/audio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: this.sessionId,
          pcm_data_b64: b64,
        }),
      });

      if (!res.ok) {
        console.warn(`[SDK] Failed to record audio: ${res.statusText}`);
      }
    } catch (e) {
      console.warn('[SDK] Error recording audio:', e);
    }
  }

  /**
   * End recording session (analysis runs in background)
   */
  async endSession() {
    if (!this.sessionId) {
      console.warn('[SDK] No active session to end');
      return;
    }

    try {
      const res = await fetch(`${this.apiBase}/api/calls/${this.sessionId}/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: this.sessionId,
        }),
      });

      if (!res.ok) {
        throw new Error(`Failed to end session: ${res.statusText}`);
      }

      const data = await res.json();
      this.isRecording = false;

      console.log(`[SDK] Recording ended: ${this.sessionId}`);
      this.emit('onSessionEnd', data);
      return data;
    } catch (e) {
      console.error('[SDK] Error ending session:', e);
      this.emit('onError', e);
      throw e;
    }
  }

  /**
   * Get analysis (may be pending if just ended)
   */
  async getAnalysis() {
    if (!this.sessionId) {
      throw new Error('No session ID');
    }

    try {
      const res = await fetch(`${this.apiBase}/api/calls/${this.sessionId}/analysis`);
      if (!res.ok) {
        throw new Error(`Failed to fetch analysis: ${res.statusText}`);
      }

      const analysis = await res.json();
      return analysis;
    } catch (e) {
      console.error('[SDK] Error fetching analysis:', e);
      throw e;
    }
  }

  /**
   * Get call history
   */
  async getCallHistory(limit = 50) {
    try {
      const url = this.agentId
        ? `${this.apiBase}/api/calls/history?agent_id=${this.agentId}&limit=${limit}`
        : `${this.apiBase}/api/calls/history?limit=${limit}`;

      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to fetch history: ${res.statusText}`);
      }

      return await res.json();
    } catch (e) {
      console.error('[SDK] Error fetching history:', e);
      throw e;
    }
  }

  /**
   * Get agent analytics
   */
  async getAgentAnalytics() {
    try {
      const res = await fetch(`${this.apiBase}/api/calls/agent/${this.agentId}/analytics`);
      if (!res.ok) {
        throw new Error(`Failed to fetch analytics: ${res.statusText}`);
      }

      return await res.json();
    } catch (e) {
      console.error('[SDK] Error fetching analytics:', e);
      throw e;
    }
  }

  /**
   * Register callback
   */
  on(event, callback) {
    if (!this.callbacks[event]) {
      this.callbacks[event] = [];
    }
    this.callbacks[event].push(callback);
  }

  /**
   * Emit callback
   */
  emit(event, ...args) {
    if (this.callbacks[event]) {
      for (const cb of this.callbacks[event]) {
        try {
          cb(...args);
        } catch (e) {
          console.error(`[SDK] Error in callback for ${event}:`, e);
        }
      }
    }
  }
}

export default CallRecordingSDK;
