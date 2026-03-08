"""SDK code generator for embeddable agent widgets."""


def generate_sdk_code(agent_id: str, agent_name: str,
                      server_url: str = "http://localhost:8000") -> dict:
    """Generate embeddable SDK code for an agent."""

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

## Quick Setup (2 minutes)

### Step 1: Add the widget to your HTML

Paste this snippet just before the closing </body> tag of your website:

```html
{html_snippet}
```

### Step 2: Customize (Optional)

You can customize the widget by modifying the configuration:

```javascript
{js_config}
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| agentId | string | required | Your agent's unique ID |
| serverUrl | string | required | Backend server URL |
| theme | string | "dark" | Widget theme ("dark" / "light") |
| position | string | "bottom-right" | Widget position on page |
| title | string | Agent name | Displayed in widget header |
| subtitle | string | - | Subtitle text |
| primaryColor | string | "#6C63FF" | Accent color (hex) |

### Step 3: Test

1. Open your website in a browser
2. A floating call button should appear in the {server_url} corner
3. Click it to start a voice call with the AI agent
4. Allow microphone access when prompted

## Requirements

- Modern browser (Chrome, Firefox, Edge, Safari)
- HTTPS recommended for microphone access
- Backend server must be reachable from client's browser

## Troubleshooting

- **Widget not showing**: Check browser console for errors. Ensure serverUrl is correct.
- **No audio**: Allow microphone permissions. Ensure HTTPS.
- **Agent not responding**: Verify the agent ID is correct and the backend is running.
"""

    return {
        "html_snippet": html_snippet,
        "js_config": js_config,
        "instructions": instructions
    }
