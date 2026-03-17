"""SDK code generator for embeddable agent widgets."""


def generate_sdk_code(agent_id: str, agent_name: str,
                      server_url: str = "http://localhost:8000") -> dict:
    """Generate embeddable SDK code for an agent (PRODUCTION-READY).

    This creates self-contained snippets that embed the AI Voice Agent widget
    on ANY website without additional dependencies.

    Args:
        agent_id: The agent's unique ID (UUID).
        agent_name: Display name for the agent.
        server_url: The backend server URL (auto-injected from request.base_url).
                   Example: https://api.example.com or https://xxx.onrender.com
    
    Returns:
        dict with:
        - html_snippet: Ready-to-paste HTML code
        - js_config: JavaScript configuration object
        - instructions: Markdown setup guide
    """

    # Ensure server_url doesn't have trailing slash
    server_url = server_url.rstrip('/')

    html_snippet = f"""<!-- AI Voice Agent Widget: {agent_name} -->
<script>
  window.AgentWidgetConfig = {{
    agentId: "{agent_id}",
    serverUrl: "{server_url}",
    theme: "dark",
    position: "bottom-right",
    title: "{agent_name}",
    subtitle: "Live voice call with AI",
    primaryColor: "#6366f1"
  }};
</script>
<script src="{server_url}/static/widget/agent-widget.js" async></script>"""

    js_config = f"""// ===== AI Voice Agent Widget Configuration =====
// Add this BEFORE the script tag that loads agent-widget.js

window.AgentWidgetConfig = {{
  // REQUIRED: Your agent's unique ID
  agentId: "{agent_id}",
  
  // REQUIRED: Your backend server URL (no trailing slash)
  serverUrl: "{server_url}",
  
  // OPTIONAL: Visual customization
  theme: "dark",              // "dark" | "light"
  position: "bottom-right",   // "bottom-right" | "bottom-left"
  title: "{agent_name}",
  subtitle: "Live voice call with AI",
  primaryColor: "#6366f1",
  secondaryColor: "#ffffff",
  
  // OPTIONAL: Behavior
  showLabel: true,            // Show "Chat with us" text
  autoExpand: false,          // Auto-open on page load
  allowChatFallback: true     // Show text chat if voice fails
}};

// Load the widget script (async to prevent blocking)
(function() {{
  var script = document.createElement('script');
  script.src = "{server_url}/static/widget/agent-widget.js";
  script.async = true;
  script.onerror = function() {{
    console.error('Failed to load AI Agent Widget');
  }};
  document.body.appendChild(script);
}})();
"""

    instructions = f"""# {agent_name} — Widget Integration Guide (Production-Ready)

This guide shows how to embed your AI Voice Agent widget on ANY website.

---

## 🚀 Quick Setup (Copy & Paste)

### Option 1: HTML Snippet (Easiest)

Paste this **before the closing `</body>` tag** of your website:

```html
{html_snippet}
```

### Option 2: Custom JavaScript (More Control)

If you have custom configuration needs:

```html
<script>
  {js_config}
</script>
```

---

## 📋 Configuration Reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| **agentId** | string | Required | Your agent's unique ID (from dashboard) |
| **serverUrl** | string | Required | Your backend URL (no trailing slash) |
| **theme** | string | "dark" | Widget theme: "dark" or "light" |
| **position** | string | "bottom-right" | Widget position: "bottom-right" or "bottom-left" |
| **title** | string | Agent name | Header title in widget |
| **subtitle** | string | "Live voice..." | Subtitle shown in header |
| **primaryColor** | string | "#6366f1" | Main accent color (hex code) |
| **secondaryColor** | string | "#ffffff" | Secondary color (hex code) |
| **showLabel** | boolean | true | Show "Chat with us" floating label |
| **autoExpand** | boolean | false | Auto-open widget on page load |
| **allowChatFallback** | boolean | true | Enable text chat if voice fails |

---

## ✨ Features

### Voice Calls
- **Real-time bidirectional audio** via Google Gemini Live API
- **Automatic speech recognition** (listen to user)
- **Text-to-speech responses** (agent speaks back)
- **Live transcription** (see what both say in real-time)

### Text Fallback
- Type messages if microphone unavailable
- Fallback to REST API if WebSocket fails
- Graceful degradation

### Knowledge Base Integration
- Agent automatically uses your uploaded KB
- Answers grounded in your documents
- No hallucination about your business

### Security
- **No API keys exposed** (all server-side)
- **CORS-enabled** for cross-origin embeds
- **Rate limiting** prevents abuse
- **Prompt injection detection** built-in

---

## 🌍 Where Can You Embed This?

✅ **WordPress blogs** — Paste in theme footer
✅ **Shopify stores** — Add to product pages
✅ **Static HTML sites** — Just paste the snippet
✅ **React/Vue/Angular apps** — Load in useEffect/mounted
✅ **Any website** with HTML access

---

## 🧪 Test the Widget

1. Add the code to your website
2. Reload the page
3. You should see a **floating 🎤 button** in the bottom-right corner
4. Click it to open the widget panel
5. Click **📞 Call** to start a voice conversation
6. Allow microphone access (browser will ask)
7. Speak naturally — the AI responds in real-time

---

## 🔧 Troubleshooting

### Widget doesn't appear
- Check browser console (F12 → Console)
- Verify `agentId` exists (copy from dashboard)
- Verify `serverUrl` is reachable (should return JSON at `/api/agents/{{agentId}}`)
- Ensure page is served over **HTTPS** in production

### No audio / microphone blocked
- The **browser requires HTTPS** for microphone access
- Check browser's microphone permissions
- Test with `https://` not `http://`
- Click "allow" when browser asks for permission

### Agent not responding
- Check that agent exists in dashboard
- Verify backend is running (test `{{serverUrl}}/docs`)
- Check browser console for errors
- Ensure `GEMINI_API_KEY` is set on backend

### CORS errors (cross-origin)
- Good news: **widget endpoints allow all origins by default**
- If still seeing CORS errors, check backend logs
- Verify `serverUrl` matches actual backend URL

### Widget loads slowly
- The widget is ~30KB minified
- Served from your backend by default
- Can be cached by CDN for faster load
- Consider CDN URLs if bandwidth is concern

---

## 🎨 Customization Examples

### Light Theme
```javascript
window.AgentWidgetConfig = {{
  agentId: "{agent_id}",
  serverUrl: "{server_url}",
  theme: "light",
  primaryColor: "#3b82f6",  // Blue
}};
```

### Bottom Left Position
```javascript
window.AgentWidgetConfig = {{
  agentId: "{agent_id}",
  serverUrl: "{server_url}",
  position: "bottom-left"
}};
```

### Auto-Open on Load
```javascript
window.AgentWidgetConfig = {{
  agentId: "{agent_id}",
  serverUrl: "{server_url}",
  autoExpand: true,
  showLabel: false
}};
```

### Custom Color Scheme
```javascript
window.AgentWidgetConfig = {{
  agentId: "{agent_id}",
  serverUrl: "{server_url}",
  primaryColor: "#ef4444",      // Red
  secondaryColor: "#fca5a5",    // Light red
  theme: "dark"
}};
```

---

## 📦 Widget Details

| Property | Value |
|----------|-------|
| **Format** | IIFE (Immediately Invoked Function Expression) |
| **Dependencies** | None (pure JavaScript) |
| **Size** | ~30KB minified, ~100KB with source maps |
| **Browser Support** | Chrome 80+, Firefox 78+, Edge 80+, Safari 14+ |
| **HTTPS Required** | Yes (for microphone in production) |
| **Performance** | <100ms initial load, <50ms for subsequent embeds |

---

## 🚀 Production Deployment Checklist

- [ ] Agent created in dashboard
- [ ] Knowledge base uploaded (optional but recommended)
- [ ] Agent ID copied from dashboard
- [ ] Backend URL verified (https://your-api.com)
- [ ] Widget code added to your website
- [ ] Website is served over HTTPS (required for microphone)
- [ ] Widget appears on page reload
- [ ] Test voice call works
- [ ] Microphone permissions granted in browser

---

## 📊 What Happens Behind the Scenes

```
User clicks 🎤 button
    ↓
Browser requests microphone permission
    ↓
User grants permission
    ↓
Widget opens WebSocket to Gemini Live API (via backend)
    ↓
Backend authenticates with Gemini API Key
    ↓
Widget starts sending audio from user's microphone
    ↓
Gemini processes audio + generates response in real-time
    ↓
Browser plays Gemini's audio response
    ↓
Transcription shown in widget for both user and agent
    ↓
User can interrupt or end call anytime
```

---

## 💬 Example Conversations

### Sales Assistant
```
Agent: "Hi! I'm the sales assistant. How can I help?"
User: "Do you have this in large?"
Agent: [Searches KB for sizing info] "Yes! We have sizes..."
```

### Customer Support
```
Agent: "Welcome to support. What's your issue?"
User: "My order tracking shows stuck"
Agent: [Searches KB, checks system] "Let me help..."
```

### Knowledge Base Assistant
```
Agent: "I'm here to help with questions. What would you like to know?"
User: "How do I reset my password?"
Agent: [Queries KB] "Go to settings > security > reset password..."
```

---

## 🔒 Security Notes

✅ **Safe to embed anywhere**:
- No API keys exposed in widget code
- All authentication server-side
- Supports CORS for cross-origin embeds
- Rate limiting prevents abuse
- Prompt injection detection built-in

✅ **User data**:
- Conversations not stored by default
- Check dashboard for call history
- Can delete agent to remove all data

✅ **Backend access**:
- Widget endpoints at `/api/widget/*`
- Public (no auth required) but scoped by agent ID
- Static files at `/static/widget/`

---

## 🆘 Still Having Issues?

1. **Check browser console** (F12 → Console tab)
2. **Test direct API call**: Go to `{server_url}/docs`
3. **Check backend logs** (where your API is running)
4. **Verify environment variables** (GEMINI_API_KEY, etc)
5. **Try the test server** at `{server_url}/` (should show API docs)

---

## 📞 Support

For issues or feature requests:
1. Check deployment guide: https://your-docs.com/DEPLOYMENT_MASTER.md
2. Review troubleshooting section above
3. Check backend logs for errors

---

**You're all set! Your audience can now chat with your AI agent directly on your website.** 🎉
"""

    return {
        "html_snippet": html_snippet,
        "js_config": js_config,
        "instructions": instructions
    }
