# 🎨 CanvasFlow Lite

A real-time collaborative whiteboard application where multiple users can draw, chat, and work together on a shared canvas.

Built using **Node.js, Express, Socket.io, SQLite, and HTML5 Canvas**.

---

## 🚀 Features

- 🖌️ Real-time collaborative drawing.
- 👥 Multi-user whiteboard rooms
- 🔄 Undo and Redo support
- 💬 Live chat with typing indicators
- 📝 Sticky notes on canvas
- 🖱️ Live cursor tracking
- 🏠 Room creation and sharing
- 💾 SQLite-based data persistence
- ⚡ WebSocket-powered communication

---

## 📌 How It Works

1. Users create or join a room.
2. Every drawing action is sent through WebSockets.
3. Connected users instantly receive updates.
4. Chat messages, drawings, and notes are stored in SQLite.
5. Users can collaborate in real time from different devices.

---

## 🏗️ System Architecture

```text
Frontend (HTML/CSS/JavaScript)
            │
            ▼
      Express Server
            │
    ┌───────┴───────┐
    ▼               ▼
 REST API      Socket.io
    │               │
    └───────┬───────┘
            ▼
      Business Logic
            │
            ▼
     SQLite Database
```

---

## 📂 Project Structure

```text
canvasflow-lite/
│
├── server.js
├── package.json
├── canvasflow.db
│
├── database/
│   └── db.js
│
├── models/
│   └── queries.js
│
├── controllers/
│   └── roomController.js
│
├── routes/
│   └── api.js
│
├── socket/
│   └── socketHandler.js
│
└── frontend/
    ├── index.html
    ├── whiteboard.html
    ├── style.css
    └── js/
        ├── state.js
        ├── socket.js
        ├── canvas.js
        ├── chat.js
        └── ui.js
```

---

## 🛠️ Tech Stack

| Technology | Purpose |
|------------|----------|
| Node.js | Backend Runtime |
| Express.js | REST APIs |
| Socket.io | Real-Time Communication |
| SQLite | Database |
| HTML5 Canvas | Drawing Board |
| JavaScript | Frontend Logic |
| CSS | Styling |

---

## ⚙️ Installation

### Clone Repository

```bash
git clone https://github.com/your-username/canvasflow-lite.git

cd canvasflow-lite
```

### Install Dependencies

```bash
npm install
```

### Run Application

```bash
npm start
```

Development Mode:

```bash
npm run dev
```

---

## 🌐 Access Application

Open your browser and visit:

```text
http://localhost:3000
```

---

## 📡 Main Features

### 🖌️ Collaborative Drawing

- Real-time drawing synchronization
- Smooth freehand strokes
- Multi-user support

### 💬 Live Chat

- Instant messaging
- Typing indicators
- Room-based communication

### 📝 Sticky Notes

- Add notes anywhere on canvas
- Edit and move notes
- Multiple color options

### 🔄 Undo / Redo

- Undo recent strokes
- Restore removed drawings

### 🖱️ Live Cursors

- View other users' cursor positions in real time

---

## 🗄️ Database Tables

| Table | Purpose |
|---------|---------|
| rooms | Stores room information |
| users | Stores connected users |
| strokes | Stores drawing history |
| messages | Stores chat messages |
| sticky_notes | Stores canvas notes |

---

## 📋 Available Scripts

```bash
npm start
```

Starts the production server.

```bash
npm run dev
```

Starts the development server with auto-reload.

---

## 🔮 Future Improvements

- User authentication
- Drawing tools (shapes, text, eraser)
- Export canvas as PNG/PDF
- Voice and video collaboration
- Multiple whiteboard pages
- Cloud database support

---

## 📄 License

This project is licensed under the MIT License!.

---

<p align="center">
Built with ❤️ using Node.js, Socket.io, SQLite, and HTML5 Canvas
</p>
