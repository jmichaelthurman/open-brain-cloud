---
layout: page
title: Mobile Capture
permalink: /mobile/
---

Open Brain Cloud supports capture from iOS and iPadOS without a dedicated app. The `POST /capture` REST endpoint accepts the same payload as the `capture_thought` MCP tool, making it easy to call from Apple Shortcuts, scripts, or any HTTP client.

---

## The `/capture` endpoint

```http
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
| -------- | -------------- |
| **Save to Open Brain** | Appears in the share sheet of any app; capture highlighted text from Claude.ai, Safari, Mail, Notes, etc. |
| **Quick Brain Capture** | Home screen icon or widget; tap to type a thought directly |

---

### Shortcut 1: "Save to Open Brain" (Share Sheet)

Open the **Shortcuts** app, tap **+**, and name it **Save to Open Brain**.

Add these action blocks in order:

#### Step 1 — Get the shared text

- Action: **Get Text from Input**
- This automatically makes the shortcut appear in the share sheet — no extra configuration needed.
- Tap the result pill → **Add to Variable** → name it `Captured Text`

#### Step 2 — Store your API key

- Action: **Text** → paste your API key: `<your-OPEN_BRAIN_API_KEY>`
- Tap the result pill → **Add to Variable** → name it `Brain API Key`

#### Step 3 — Build the Authorization header

- Action: **Text** → type `Bearer ` (with a trailing space), then tap the variable picker and insert **Brain API Key**
- Tap the result pill → **Add to Variable** → name it `Auth Header`

#### Step 4 — Send to Open Brain Cloud

- Action: **Get Contents of URL**
  - URL: `https://open-brain-cloud.fly.dev/capture`
  - Tap **Show More** → Method: **POST**
  - Request Body: **JSON** → tap **Add new field**:
    - Key: `content` → Value: variable **Captured Text**
    - Key: `source` → Value: text `ios-shortcut`
  - Headers → tap **Add new header**:
    - Key: `Authorization` → Value: variable **Auth Header**
    - Key: `Content-Type` → Value: text `application/json`

#### Step 5 — Success notification

- Action: **Show Notification**
  - Title: `Open Brain`
  - Body: `Saved`

Tap **Done**. To confirm it appears in the share sheet: open Safari or Notes, select some text, tap the share icon, scroll down — **Save to Open Brain** should appear in the Shortcuts section.

---

### Shortcut 2: "Quick Brain Capture" (Widget / Home Screen)

Open the **Shortcuts** app, tap **+**, and name it **Quick Brain Capture**.

#### Step 1 — Store your API key

- Action: **Text** → paste your API key: `<your-OPEN_BRAIN_API_KEY>`
- Tap the result pill → **Add to Variable** → name it `Brain API Key`

#### Step 2 — Build the Authorization header

- Action: **Text** → type `Bearer` followed by a single space, then tap the variable picker and insert **Brain API Key**
- Tap the result pill → **Add to Variable** → name it `Auth Header`

#### Step 3 — Ask for input

- Action: **Ask for Input** → Prompt: `What's on your mind?` → Type: Text
- Tap the result pill → **Add to Variable** → name it `Captured Text`

#### Step 4 — POST to the capture endpoint

- Action: **Get Contents of URL**
  - URL: `https://open-brain-cloud.fly.dev/capture`
  - Tap **Show More** → Method: **POST**
  - Request Body: **JSON** → tap **Add new field**:
    - Key: `content` → Value: variable **Captured Text**
    - Key: `source` → Value: text `ios-shortcut`
  - Headers → tap **Add new header**:
    - Key: `Authorization` → Value: variable **Auth Header**
    - Key: `Content-Type` → Value: text `application/json`

#### Step 5 — Notify on success

- Action: **Show Notification**
  - Title: `Open Brain`
  - Body: `Saved`

Tap **Done**. To add as a home screen icon: long-press the shortcut → **Add to Home Screen**. To add as a widget: long-press the home screen → tap **+** → search Shortcuts → choose the widget size → select **Quick Brain Capture**.

---

### Keep your API key in one place (advanced)

If you build multiple shortcuts and want to rotate the API key from a single location, create a "key holder" shortcut:

1. Create a new shortcut named **Brain Config**.
2. Add a **Text** action containing your API key.
3. Add **Exit Shortcut** with output set to the Text block.

In your other shortcuts, replace the Text + Set Variable steps for the key with:

- Action: **Run Shortcut** → choose **Brain Config**
- Use the output as the **Brain API Key** variable.

---

### Tips

- **Shortcut not appearing in share sheet:** Scroll down past the standard share options — shortcuts appear in a dedicated Shortcuts section at the bottom. The shortcut must have **Get Text from Input** as its first action.
- **No notification appears:** Check Settings → Notifications → Shortcuts → ensure notifications are allowed.
- **"Could not connect" error:** Verify you are online and that the URL is exactly `https://open-brain-cloud.fly.dev/capture` (no trailing slash).
- **Empty content saved:** Make sure text is actually selected before tapping Share. The shortcut captures whatever text was passed by the sharing app.

---

## Future plans

- **Progressive Web App (PWA)** — a simple web interface for capture and search, installable to the iOS home screen without the Shortcuts setup
- **Slack integration** — capture from a Slack slash command or message action, tagging the source as `slack`
- **Raycast / Alfred extension** — desktop quick-capture from a launcher
