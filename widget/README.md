# AI Voice Agent Widget — Integration Guide

## Quick Start

### 1. Add the Widget Script

Paste this code just before `</body>` on your website:

```html
<script>
  window.AgentWidgetConfig = {
    agentId: "YOUR_AGENT_ID",
    serverUrl: "https://your-server.com",
    theme: "dark",
    position: "bottom-right",
    title: "AI Assistant",
    subtitle: "Click to start a voice call",
    primaryColor: "#6C63FF"
  };
</script>
<script src="https://your-server.com/static/widget/agent-widget.js"></script>
```

### 2. Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `agentId` | string | **required** | Agent ID from your dashboard |
| `serverUrl` | string | **required** | Your backend server URL |
| `theme` | string | `"dark"` | Widget theme (`"dark"` / `"light"`) |
| `position` | string | `"bottom-right"` | Widget position (`"bottom-right"` / `"bottom-left"`) |
| `title` | string | `"AI Assistant"` | Header title |
| `subtitle` | string | — | Header subtitle |
| `primaryColor` | string | `"#6C63FF"` | Accent color (hex) |

### 3. Features

- 🎤 **Live Voice Calls** — Real-time bidirectional audio via Gemini Live API
- ⌨️ **Text Chat Fallback** — Type messages when voice isn't available
- 📚 **Knowledge Base** — Agent uses your uploaded KB data to answer questions
- 🔇 **Mute/Unmute** — Toggle mic during live calls
- 📞 **Call-End Detection** — Agent confirms before ending calls
- 🌙 Dark mode / ☀️ Light mode
- 📱 Responsive design

### 4. How It Works

1. Widget loads on client's page and renders a floating 🎤 button
2. User clicks the mic → widget fetches agent config + KB from your backend
3. Widget connects directly to Gemini Live API via WebSocket
4. Mic audio streams to Gemini in real-time, agent audio plays back
5. Transcriptions appear in the chat panel
6. Text chat available as fallback (uses multi-agent orchestrator on backend)

### 5. Requirements

- Modern browser (Chrome 80+, Firefox 78+, Edge 80+, Safari 14+)
- **HTTPS required** for microphone access on production sites
- Backend server must be accessible from client browser
- `GEMINI_API_KEY` must be set on the backend
