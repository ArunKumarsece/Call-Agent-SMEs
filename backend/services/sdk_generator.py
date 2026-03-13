"""SDK code generator for embeddable agent widgets."""


def generate_sdk_code(agent_id: str, agent_name: str,
                      server_url: str = "http://localhost:8000") -> dict:
    """Generate embeddable SDK code for an agent.

    Args:
        agent_id: The agent's unique ID.
        agent_name: Display name for the agent.
        server_url: The backend server URL (should be the deployed URL).
    """

    html_snippet = f"""<!-- AI Voice Agent Widget — {agent_name} -->
<script>
  window.AgentWidgetConfig = {{
    agentId: "{agent_id}",
    serverUrl: "{server_url}",
    theme: "dark",
    position: "bottom-right",
    title: "{agent_name}",
    subtitle: "Click to start a voice call",
    primaryColor: "#6C63FF"
  }};
</script>
<script src="{server_url}/static/widget/agent-widget.js"></script>"""

    js_config = f"""// Agent Widget Configuration
window.AgentWidgetConfig = {{
  agentId: "{agent_id}",
  serverUrl: "{server_url}",
  theme: "dark",           // "dark" or "light"
  position: "bottom-right", // "bottom-right" or "bottom-left"
  title: "{agent_name}",
  subtitle: "Click to start a voice call",
  primaryColor: "#6C63FF"  // Accent color
}};"""

    instructions = f"""# {agent_name} — Widget Integration Guide

## Quick Setup

### Step 1: Add the widget to your HTML

Paste this snippet just before the closing `</body>` tag of your website:

```html
{html_snippet}
```

### Step 2: Customize (Optional)

Modify the configuration object to match your brand:

```javascript
{js_config}
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| agentId | string | required | Your agent's unique ID |
| serverUrl | string | required | Backend server URL |
| theme | string | "dark" | Widget theme ("dark" / "light") |
| position | string | "bottom-right" | Widget position ("bottom-right" / "bottom-left") |
| title | string | Agent name | Displayed in widget header |
| subtitle | string | - | Subtitle text below title |
| primaryColor | string | "#6C63FF" | Accent color (hex) |

### Step 3: Test

1. Open your website in a browser
2. A floating 🎤 button appears at the bottom-right corner
3. Click it to open the widget panel
4. Click the 📞 button to start a live voice call
5. Allow microphone access when prompted
6. Speak naturally — the AI agent will respond in real-time
7. You can also type messages in the text input for text chat

## Features

- **Live Voice Calls** — Real-time bidirectional audio via Gemini Live API
- **Text Chat Fallback** — Type messages when voice isn't available
- **Knowledge Base** — Agent uses your uploaded KB data to answer questions
- **Mute/Unmute** — Toggle mic during calls
- **Call End Detection** — Agent confirms before ending calls
- **Responsive** — Works on desktop and mobile browsers

## Requirements

- Modern browser (Chrome 80+, Firefox 78+, Edge 80+, Safari 14+)
- **HTTPS required** for microphone access on production sites
- Backend server must be accessible from the client's browser

## Troubleshooting

- **Widget not showing**: Check browser console for errors. Verify `serverUrl` is correct and reachable.
- **No audio / mic blocked**: Ensure the page is served over HTTPS. Allow microphone permissions.
- **"No Gemini API key" error**: Make sure `GEMINI_API_KEY` is set on the backend server.
- **Agent not responding**: Verify the agent ID exists and the backend is running.
- **CORS errors**: The backend allows all origins by default for widget endpoints.
"""

    return {
        "html_snippet": html_snippet,
        "js_config": js_config,
        "instructions": instructions
    }
