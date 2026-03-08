# AI Voice Agent Widget — Integration Guide

## Quick Start

### 1. Add the Widget Script

Paste this code just before `</body>` on your website:

```html
<script>
  window.AgentWidgetConfig = {
    agentId: "YOUR_AGENT_ID",
    serverUrl: "http://your-server:8000",
    theme: "dark",          // "dark" or "light"
    position: "bottom-right", // "bottom-right" or "bottom-left"
    title: "AI Assistant",
    subtitle: "Click to start a voice call",
    primaryColor: "#6C63FF"
  };
</script>
<script src="http://your-server:8000/static/widget/agent-widget.js"></script>
```

### 2. Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `agentId` | string | **required** | Agent ID from your dashboard |
| `serverUrl` | string | **required** | Your backend server URL |
| `theme` | string | `"dark"` | Widget theme |
| `position` | string | `"bottom-right"` | Widget position |
| `title` | string | `"AI Assistant"` | Header title |
| `subtitle` | string | — | Header subtitle |
| `primaryColor` | string | `"#6C63FF"` | Accent color |

### 3. Features

- 🎤 Voice call with AI agent
- ⌨️ Text chat fallback
- 🔇 Noise suppression (browser built-in)
- 🌙 Dark mode / ☀️ Light mode
- 📱 Responsive design
- 🔌 WebSocket real-time connection

### 4. Requirements

- Modern browser (Chrome 80+, Firefox 78+, Edge 80+, Safari 14+)
- HTTPS recommended for microphone access
- Backend server must be accessible from client browser
