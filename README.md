✨ VibeVerse – Dynamic Quote & Wallpaper Generator

VibeVerse is an interactive web application that helps users discover inspiring quotes, explore mood-based recommendations, create beautiful wallpapers, and save personal reflections in a journal.

🌟 Features

- 💬 Dynamic quote generation
- 😊 Mood-based quote recommendations
- 🖼️ Wallpaper generation and customization
- ❤️ Favorite quotes
- 📜 Quote history
- 🔐 User registration and login
- 📔 Personal quote journal
- 🔎 Quote search
- 🗄️ MongoDB database integration

🛠️ Technologies Used

- Frontend: HTML, CSS, JavaScript
- Backend: Node.js, Express.js
- Database: MongoDB, Mongoose
- Authentication: JSON Web Tokens (JWT)

📂 Project Structure

VibeVerse-Dynamic-Quote-Wallpaper-Generator/
├── public/
│   ├── index.html
│   ├── style.css
│   └── script.js
├── server.js
├── package.json
├── package-lock.json
├── .gitignore
└── README.md

⚙️ How to Run Locally

1. Clone or download this repository.

2. Open the project folder in VS Code.

3. Install dependencies:
   
   npm install

4. Create a ".env" file in the project root and configure the environment variables required by "server.js", including your MongoDB connection string and JWT secret.

5. Start the application using the command configured in "package.json":
   
   npm run dev
   
   If a "dev" script is not configured, use:
   
   node server.js

6. Open the local URL displayed in your terminal.

🔒 Security

- Never upload your ".env" file to GitHub.
- Keep database credentials and JWT secrets private.
- Ensure ".env" and "node_modules/" are included in ".gitignore".

🎯 Project Goal

VibeVerse brings together inspirational quotes, mood-based discovery, personalized wallpaper creation, and personal journaling in one interactive web application.

---

Developed with ❤️ using HTML, CSS, JavaScript, Node.js, Express.js, and MongoDB.
