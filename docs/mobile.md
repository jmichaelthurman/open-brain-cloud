---
layout: page
title: Mobile Capture
permalink: /mobile/
---

# Mobile Capture

Open Brain Cloud supports capture from iOS and iPadOS without a dedicated app. The `POST /capture` REST endpoint accepts the same payload as the `capture_thought` MCP tool, making it easy to call from Apple Shortcuts, scripts, or any HTTP client.

---

## The `/capture` endpoint

```
POST https://open-brain-cloud.fly.dev/capture
Authorization: Bearer <your-OPEN_BRAIN_API_KEY>
Content-Type: application/json
```

**Request body:**

```json
{
  "content": "The thought or note to save",
  "source": "ios-shortcut",
  "people": ["optional", "array"],
  "topics": ["optional", "array"],
  "action_items": ["optional", "array"]
}
```

Only `content` is required. The `source` field is stored as-is and shows up in `stats()` — use it to track which client submitted a thought.

**Response 200:**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "suggested_links": [
    {
      "thought_id": "...",
      "content": "A semantically similar existing thought",
      "similarity": 0.79
    }
  ]
}
```

**Input limits:** `content` max 50,000 characters; arrays max 50 elements, 500 characters each; body max 1 MB.

---

## iOS / iPadOS setup with Apple Shortcuts

Apple Shortcuts can call `POST /capture` from any app's share sheet or as a home screen icon. No additional apps are required — just the built-in Shortcuts app on iOS 16 or later.

There are two shortcuts to build:

| Shortcut | How you use it |
|----------|---------------|
| **Save to Open Brain** | Appears in the share sheet of any app; capture highlighted text from Claude.ai, Safari, Mail, Notes, etc. |
| **Quick Brain Capture** | Home screen icon or widget; tap to type a thought directly |

---

### Shortcut 1: "Save to Open Brain" (Share Sheet)

Open the **Shortcuts** app, tap **+**, and name it **Save to Open Brain**.

Add these action blocks in order:

**1. Receive Input from Share Sheet**
- Action: "Receive Input from Share Sheet"
- Input Type: Text
- If there's no input: Continue (the next block handles the fallback)

**2. Fallback to Clipboard**
- Action: If
- Condition: Shortcut Input → has no value
- Inside **If**: Get Clipboard → Set Variable "Captured Text" = Clipboard
- Inside **Otherwise**: Set Variable "Captured Text" = Shortcut Input
- End If

**3. Store your API key**
- Action: Text → paste your API key: `<your-OPEN_BRAIN_API_KEY>`
- Action: Set Variable "Brain API Key" = the Text block above

**4. Build the Authorization header**
- Action: Text → type `Bearer ` (with a trailing space), then insert variable **Brain API Key**
- Action: Set Variable "Auth Header" = the Text block above

**5. Optional context prompt**
- Action: Ask for Input → Prompt: `Add a quick note? (optional — press Cancel to skip)` → Type: Text
- Action: If → Ask for Input result has value
  - Inside **If**: Text → `[Captured Text]\n\n[Ask for Input result]` → Set Variable "Final Content"
  - Inside **Otherwise**: Set Variable "Final Content" = Captured Text
- End If

**6. Send to Open Brain Cloud**
- Action: Get Contents of URL
  - URL: `https://open-brain-cloud.fly.dev/capture`
  - Method: POST
  - Request Body: JSON
  - Fields:
    - `content` → variable **Final Content**
    - `source` → text `ios-shortcut`
  - Headers:
    - `Authorization` → variable **Auth Header**
    - `Content-Type` → text `application/json`

**7. Success notification**
- Action: Show Notification
  - Title: `Open Brain`
  - Body: `Saved to Open Brain`

Tap **Done** to save. To add it to your share sheet, open any app's share menu, scroll down, tap **More**, and pin **Save to Open Brain**.

---

### Shortcut 2: "Quick Brain Capture" (Widget / Home Screen)

Open the **Shortcuts** app, tap **+**, and name it **Quick Brain Capture**.

**1. Store your API key**
- Action: Text → `<your-OPEN_BRAIN_API_KEY>`
- Action: Set Variable "Brain API Key"

**2. Build the Authorization header**
- Action: Text → `Bearer ` + variable **Brain API Key**
- Action: Set Variable "Auth Header"

**3. Ask for input**
- Action: Ask for Input → Prompt: `What's on your mind?` → Type: Text
- Action: Set Variable "Captured Text" = Provided Input

**4. Send to Open Brain Cloud**
- Action: Get Contents of URL
  - URL: `https://open-brain-cloud.fly.dev/capture`
  - Method: POST
  - Request Body: JSON
  - Fields:
    - `content` → variable **Captured Text**
    - `source` → text `ios-shortcut`
  - Headers:
    - `Authorization` → variable **Auth Header**
    - `Content-Type` → text `application/json`

**5. Success notification**
- Action: Show Notification
  - Title: `Open Brain`
  - Body: `Saved to Open Brain`

Tap **Done**. To add as a home screen icon: long-press the shortcut → **Add to Home Screen**. To add as a widget: long-press the home screen → tap **+** → search Shortcuts → choose the widget size → tap **Choose** to select **Quick Brain Capture**.

---

### Keep your API key in one place (advanced)

If you build multiple shortcuts and want to rotate the API key from a single location, create a "key holder" shortcut:

1. Create a new shortcut named **Brain Config**.
2. Add a **Text** action containing your API key.
3. Add **Exit Shortcut** with output set to the Text block.

In your other shortcuts, replace the Text + Set Variable steps for the key with:

- Action: Run Shortcut → choose **Brain Config**
- Use the output as the **Brain API Key** variable.

---

### Tips

- **Share sheet not showing the shortcut:** On iOS 17+, shortcuts appear automatically in the share sheet's Shortcuts section — scroll down to find it. On iOS 16, go to Settings → Shortcuts → Advanced → enable **Allow Sharing Large Amounts of Data**, then open the share sheet in any app, tap **More**, and pin it.
- **No notification appears:** Check Settings → Notifications → Shortcuts → ensure notifications are allowed.
- **"Could not connect" error:** Verify you are online and that the URL is exactly `https://open-brain-cloud.fly.dev/capture` (no trailing slash).
- **Empty content saved:** The clipboard fallback only works when the shortcut is opened directly (not via share sheet). When sharing from an app, make sure text is actually selected before tapping Share.

---

## Future plans

- **Progressive Web App (PWA)** — a simple web interface for capture and search, installable to the iOS home screen without the Shortcuts setup
- **Slack integration** — capture from a Slack slash command or message action, tagging the source as `slack`
- **Raycast / Alfred extension** — desktop quick-capture from a launcher
