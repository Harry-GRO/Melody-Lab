# MelodyLab 🎵

A browser-based audio editor that allows users to upload, manipulate, and export audio files.

---

## Features

### Audio Playback & Controls
- Upload audio files directly from your device (supports MP3, OGG, FLAC, WebM and more)
- Play/pause controls with a real-time progress bar
- Seek to any point in the track by clicking the progress bar

### Audio Manipulation
- **Volume** — Adjust playback volume from 0% to 150%
- **Speed** — Change playback speed from 0.5x to 1.5x with automatic pitch adjustment
- **Stereo Panning** — Manually control left/right audio balance, or enable auto-pan mode
- All controls update in real time via the Web Audio API

### Export
- Export your edited audio directly from the browser

### User Accounts
- Secure registration and login system
- Each user gets their own isolated file storage
- Files are automatically cleaned up when a new upload is made

---

## Tech Stack

- **Backend:** Django 4.2
- **Frontend:** Vanilla JavaScript, Web Audio API, HTML/CSS
- **Database:** SQLite
- **Auth:** Django's built-in authentication system

---

## Getting Started

### Prerequisites
- Python 3.10+
- pip

### Installation

1. **Clone the repository**
   ```bash
   git clone git@github.com:Harry-GRO/Melody-Lab.git
   cd Melody-Lab
   ```

2. **Create and activate a virtual environment**
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Create a `.env` file** in the project root:
   ```
   SECRET_KEY=your-secret-key-here
   DEBUG=True
   ALLOWED_HOSTS=localhost,127.0.0.1
   STATIC_URL=/static/
   MEDIA_URL=/media/
   ```

5. **Run migrations**
   ```bash
   python3 manage.py migrate
   ```

6. **Start the development server**
   ```bash
   python3 manage.py runserver
   ```

7. Visit `http://127.0.0.1:8000` in your browser.

---

## Project Structure

```
melodyLab/
├── app/                  # Core audio editor app
│   ├── static/           # JS, CSS, images
│   ├── templates/        # Editor & home templates
│   ├── views.py
│   ├── models.py
│   └── urls.py
├── users/                # Authentication app
│   ├── templates/        # Login & register templates
│   ├── views.py
│   └── urls.py
├── melodyLab/            # Project settings
│   ├── settings.py
│   └── urls.py
├── requirements.txt
└── manage.py
```

---

## Licence

This project is for personal/educational use.