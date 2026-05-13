<div align="center">

# 🎓 CourseTracker AI

### ✨ Track every lecture. Never lose your place. ✨

A modern **Chrome Extension** that auto-detects course websites and adds a smart progress-tracking system beside every video.

![Manifest V3](https://img.shields.io/badge/Manifest-V3-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-Vanilla-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![License](https://img.shields.io/badge/License-MIT-22c55e?style=for-the-badge)
![Status](https://img.shields.io/badge/Status-Active-6366f1?style=for-the-badge)

</div>

---

## 🚀 What it does

Open a course page → checkboxes appear → tick what you've watched → progress bar updates → state is saved forever.

```text
   ┌─────────────────────────────────┐
   │  CourseTracker AI               │
   │  Progress  18 / 45        40%   │
   │  ████████████░░░░░░░░░░░░░░░    │
   └─────────────────────────────────┘
   ☑  1. Introduction
   ☑  2. Setup
   ☐  3. Variables & Types
   ☐  4. Functions
```

---

## ✨ Features

| | |
|---|---|
| 🎯 **Auto detect** | Works on Udemy, Coursera, YouTube playlists, 100xDevs, and any generic course-style site |
| ✅ **Inline checkboxes** | Tick lectures right where they live in the page |
| 📊 **Live progress bar** | Floating sidebar shows completion in real time |
| ⏱️ **Total playlist duration** | See watched / remaining / total time at a glance |
| 💾 **Persistent state** | `chrome.storage.local` keeps your progress across sessions |
| 🌗 **Dark / Light / Auto** | Adapts to your system theme automatically |
| ⏸️ **Stop / ▶️ Resume** | One click to pause tracking on any page |
| 🙈 **Hide / 🙉 Show** | Collapse to a floating handle when you don't need it |
| 🔄 **SPA-aware** | MutationObserver + URL polling keeps up with React / lazy-load |
| 📂 **Custom playlists** | Cherry-pick lectures into named playlists that open in a dedicated tab |
| 📤 **Export / Import** | Backup your progress as JSON |
| ⚡ **Zero build** | Pure vanilla JS — no bundler, no dependencies |

---

## 🌐 Supported Platforms

<div align="center">

| Platform | Status |
|----------|:------:|
| 🎬 YouTube playlists | ✅ |
| 🟪 Udemy | ✅ |
| 🔵 Coursera | ✅ |
| 🟧 100xDevs | ✅ |
| 🌍 Generic course sites | ✅ |

</div>

---

## 📦 Installation

```bash
git clone https://github.com/mightbeanshuu/CourseTracker-AI.git
```

1. Open `chrome://extensions/`
2. Toggle **Developer mode** on (top-right)
3. Click **Load unpacked**
4. Select the `CourseTracker-AI/` folder
5. Pin the extension and open any supported course page 🎉

---

## 🎮 Usage

| Action | Where |
|---|---|
| Tick a lecture | Checkbox beside the lecture title |
| See progress | Floating sidebar (top-right) |
| Pause tracking | ⏸ button in sidebar or popup |
| Hide sidebar | ✕ button → floating handle returns it |
| Rescan page | Sidebar → "Rescan" or popup → "Rescan" |
| Toggle theme | Sidebar → "Theme" cycles dark / light / auto |
| Export / Import | Popup → bottom buttons |
| Reset course | Popup → "Reset this course" |

---

## 🏗️ Architecture

```text
              ┌────────────────────┐
              │     manifest.json  │  ← MV3
              └─────────┬──────────┘
                        │
        ┌───────────────┼────────────────┐
        │               │                │
   ┌────▼─────┐   ┌─────▼─────┐    ┌─────▼─────┐
   │background│   │ content.js│    │  popup/   │
   │  worker  │   │           │    │           │
   └──────────┘   └─────┬─────┘    └─────┬─────┘
                        │                │
              ┌─────────┴────────────────┘
              │
      ┌───────▼──────────┐
      │  utils/          │
      │   • domScanner   │  platform detect + lecture extract
      │   • progress     │  completion math
      │   • storage      │  chrome.storage.local wrapper
      └──────────────────┘
```

---

## 📂 Folder Structure

```text
CourseTracker-AI/
├── 📄 manifest.json
├── ⚙️  background.js
├── 🧠 content.js
├── 📁 popup/
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── 🎨 styles/
│   └── content.css
├── 🔧 utils/
│   ├── domScanner.js
│   ├── storage.js
│   └── progress.js
└── 🖼️  assets/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## 🧮 Progress Formula

```text
Completion % = (Completed Videos / Total Videos) × 100
```

Updates instantly on every tick / untick.

---

## 💾 Data Schema

```json
{
  "ct_courses": {
    "udemy.com/course/example": {
      "url": "udemy.com/course/example",
      "lectures": {
        "lec_abc_0": { "done": true,  "title": "Intro",  "index": 0, "duration": "4:12" },
        "lec_def_1": { "done": false, "title": "Setup",  "index": 1, "duration": "8:30" }
      },
      "meta": { "createdAt": 1700000000000, "updatedAt": 1700000000000 }
    }
  },
  "ct_settings": {
    "theme": "auto",
    "enabled": true,
    "hidden": false
  }
}
```

---

## 🔐 Permissions

```json
["storage", "activeTab", "scripting"]
```

🟢 **No tracking. No analytics. No network calls. Everything stays on your device.**

---

## 🛠️ Tech Stack

- 🧩 Chrome Extension Manifest V3
- 🟨 Vanilla JavaScript (no build step)
- 🎨 CSS custom-properties (Tailwind-style tokens)
- 💾 Chrome Storage API
- 👁️ MutationObserver + SPA URL listener

---

## 🗺️ Roadmap

- [ ] 🤖 AI-generated lecture notes & summaries
- [ ] 📍 Resume-where-you-left
- [ ] 🔔 Smart reminders & streaks
- [ ] 🎯 Focus / Pomodoro mode
- [ ] ☁️ Cloud sync (Supabase / Firebase)
- [ ] 📱 Cross-device sync via `chrome.storage.sync`
- [ ] 📈 Daily study analytics

---

## 🧑‍💻 Development

```bash
# 1. Make your changes
# 2. Reload the extension at chrome://extensions/
# 3. Refresh the course tab — done. No build step.
```

Adding a new platform? Extend `utils/domScanner.js`:

```js
case PLATFORMS.MY_NEW_PLATFORM:
  items = scanMyNewPlatform();
  break;
```

---

## 📜 License

[MIT](LICENSE) © [mightbeanshuu](https://github.com/mightbeanshuu)

---

<div align="center">

### ⭐ Star the repo if it helps you stay on track!

**Made with 💜 for self-learners everywhere**

</div>
