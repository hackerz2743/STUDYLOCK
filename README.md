# 🔒 StudyLock

**StudyLock** is a high-performance Windows workstation application designed specifically for competitive exam aspirants (JEE, NEET, UPSC, GATE) and deep-work professionals to completely eliminate digital procrastination.

---

## ✨ Key Features

### 1. 🎬 YouTube Lecture Immersion (Direct Watch Engine)
- **100% Direct Watch Streaming:** Plays YouTube lectures directly with raw video/audio streams—immune to third-party embedding restrictions (Error 150 / 152).
- **Distraction-Free Isolation:** Completely strips recommendations, comments, home feeds, shorts, search bars, and end-screen cards.
- **Single-Lecture Lockdown:** Prevents roaming away from your chosen study video.
- **Stage Preview:** 16:9 theater screen allows you to verify audio and video live before locking in.

### 2. ⏳ Universal Focus Clock (Dual-Mode)
- **🔒 Strict Lock-In Mode:**
  - Fullscreen kiosk covering 85%–90% of your screen with colossal flip digits.
  - Blocks `Alt + Tab`, taskbar, and Windows shortcuts.
  - Requires a physical 6-digit notebook code to exit early.
- **🔓 Normal Free Mode:**
  - Full desktop freedom: `Alt + Tab` and all your PC apps work normally.
  - Multitask between PDF readers, mock test paper analysis, and notes while the clock tracks your focus time.
  - **📌 Float Mini-Clock:** Shrinks the clock into a sleek floating widget (340×110px) in the corner of your screen that stays always-on-top.

### 3. 👨‍👩‍👦 "Padhai Proof" Parent Verification Screen (Shortcut: `Tab`)
- Tap **`Tab`** anytime during a study session to display an 85% screen-coverage verification card.
- Written in clear, respectful **Hinglish** with **zero technical jargon**.
- Displays Subject, Chapter, live time studied, time remaining, and dynamic milestone messages based on how long you've studied.
- Tap **`Tab`** again to return instantly to your lecture.

### 4. 🛡️ Unbreakable Accountability & Friction
- **Physical 6-Digit Notebook Code:** Write a random 6-digit code on physical paper before starting and keep it in another room. Once locked in, it disappears from screen.
- **Zero Typing Shortcuts:** Completely eliminates essay/pledge typing loopholes.
- **Hardware Panic Chord:** `Ctrl + Alt + Shift + F12` emergency failsafe.
- **Real-Time Incremental Autosave:** Automatically records every study second to local database with zero data loss.

---

## 🚀 Installation & Running

### Option A: Windows Installer / Standalone Executable
Download the latest `StudyLock-Installer.exe` or portable `StudyLock.exe` from the [Releases](https://github.com/hackerz2743/STUDYLOCK/releases) section.

### Option B: Run from Source
```bash
# Clone the repository
git clone https://github.com/hackerz2743/STUDYLOCK.git

# Navigate to directory
cd STUDYLOCK

# Install dependencies
npm install

# Start development app
npm start

# Build Windows Executable & Installer
npm run dist
```

---

## 🛠️ Tech Stack
- **Framework:** Electron 45.x
- **Frontend:** Vanilla HTML5, Modern CSS3 (Glassmorphism & Flexbox/Grid), JavaScript ES6+
- **Packager:** electron-builder (NSIS & Portable targets)

---

## 📜 License
MIT License. Free for all students and developers.
