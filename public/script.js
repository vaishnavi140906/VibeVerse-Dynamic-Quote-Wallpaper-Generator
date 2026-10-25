"use strict";

/* =========================================
   VIBEVERSE — DYNAMIC QUOTE & WALLPAPER
   Backend: Node.js + Express
   Storage: Browser localStorage (no database)
========================================= */

const API_URL = "/api/quote-wallpaper";

const STORAGE_KEYS = {
  favorites: "vibeverse_favorites",
  history: "vibeverse_history"
};

const MAX_HISTORY = 20;

/* ---------- HTML ELEMENTS ---------- */

const wallpaperCard = document.getElementById("wallpaperCard");
const quoteText = document.getElementById("quoteText");
const quoteAuthor = document.getElementById("quoteAuthor");
const favoriteButton = document.getElementById("favoriteButton");
const generateButton = document.getElementById("generateButton");
const copyButton = document.getElementById("copyButton");
const shareButton = document.getElementById("shareButton");
const wallpaperButton = document.getElementById("wallpaperButton");
const statusMessage = document.getElementById("statusMessage");
const favoritesList = document.getElementById("favoritesList");
const favoriteCount = document.getElementById("favoriteCount");
const navFavoriteCount = document.getElementById("navFavoriteCount");
const historyList = document.getElementById("historyList");
const clearHistoryButton = document.getElementById("clearHistoryButton");
const generatedTime = document.getElementById("generatedTime");
const toast = document.getElementById("toast");

/* ---------- APP STATE ---------- */

let currentQuote = null;
let toastTimer = null;
let requestInProgress = false;

/* ---------- STORAGE HELPERS ---------- */

function readStorage(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch (error) {
    console.warn("Could not read saved browser data:", error);
    return [];
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error("Could not save browser data:", error);
    showToast("Browser storage is unavailable. Your changes may not persist.");
    return false;
  }
}

function getFavorites() {
  return readStorage(STORAGE_KEYS.favorites);
}

function getHistory() {
  return readStorage(STORAGE_KEYS.history);
}

/* ---------- SAFE HTML ---------- */

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}

/* ---------- NOTIFICATIONS ---------- */

function showToast(message) {
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2600);
}

function setStatus(message) {
  if (statusMessage) {
    statusMessage.textContent = message;
  }
}

/* ---------- WALLPAPER VALIDATION ---------- */

function isValidWallpaper(url) {
  try {
    const parsed = new URL(url, window.location.origin);

    return (
      parsed.protocol === "https:" &&
      parsed.hostname === "picsum.photos"
    );
  } catch {
    return false;
  }
}

/* ---------- QUOTE VALIDATION ---------- */

function normalizeQuote(data) {
  if (
    !data ||
    typeof data.quote !== "string" ||
    typeof data.author !== "string" ||
    typeof data.wallpaper !== "string"
  ) {
    throw new Error("The server returned an invalid response.");
  }

  if (!isValidWallpaper(data.wallpaper)) {
    throw new Error("The server returned an invalid wallpaper URL.");
  }

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    quote: data.quote,
    author: data.author,
    wallpaper: data.wallpaper,
    generatedAt: data.generatedAt || new Date().toISOString()
  };
}

/* ---------- GENERATE A NEW VIBE ---------- */

async function generateQuote() {
  if (requestInProgress) return;

  requestInProgress = true;
  generateButton.disabled = true;

  const originalButtonText = generateButton.innerHTML;
  generateButton.innerHTML = "✨ Finding your vibe...";

  setStatus("Finding a fresh quote and wallpaper for you...");

  try {
    const response = await fetch(API_URL, {
      method: "GET",
      headers: {
        Accept: "application/json"
      },
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    const data = await response.json();
    const newQuote = normalizeQuote(data);

    currentQuote = newQuote;

    renderCurrentQuote();
    saveToHistory(currentQuote);
    renderFavorites();
    renderHistory();

    setStatus("Your fresh vibe is ready! ✨");
  } catch (error) {
    console.error("Quote generation failed:", error);

    if (!currentQuote) {
      currentQuote = {
        id: `${Date.now()}-offline`,
        quote: "Every moment is a fresh beginning.",
        author: "T. S. Eliot",
        wallpaper:
          "https://picsum.photos/seed/vibeverse-offline/1920/1080",
        generatedAt: new Date().toISOString()
      };

      renderCurrentQuote();
    }

    setStatus(
      "Could not connect to the backend. Start your server and try again."
    );

    showToast("Backend connection failed. Check that your server is running.");
  } finally {
    requestInProgress = false;
    generateButton.disabled = false;
    generateButton.innerHTML = originalButtonText;
  }
}

/* ---------- RENDER CURRENT QUOTE ---------- */

function renderCurrentQuote() {
  if (!currentQuote) return;

  quoteText.textContent = currentQuote.quote;
  quoteAuthor.textContent = `— ${currentQuote.author}`;

  wallpaperCard.style.backgroundImage = `
    linear-gradient(90deg, #251237c9, #2e1a3c50),
    url("${currentQuote.wallpaper}")
  `;

  if (generatedTime) {
    generatedTime.textContent = new Date(
      currentQuote.generatedAt
    ).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  updateFavoriteButton();

  const content = document.getElementById("wallpaperContent");

  if (content) {
    content.style.animation = "none";
    void content.offsetWidth;
    content.style.animation = "fadeUp 0.5s ease";
  }
}

/* ---------- FAVOURITES ---------- */

function isFavorite(quote) {
  if (!quote) return false;

  return getFavorites().some(item =>
    item.quote === quote.quote &&
    item.author === quote.author
  );
}

function updateFavoriteButton() {
  if (!currentQuote || !favoriteButton) return;

  const saved = isFavorite(currentQuote);

  favoriteButton.classList.toggle("active", saved);
  favoriteButton.textContent = saved ? "♥" : "♡";

  favoriteButton.setAttribute(
    "aria-label",
    saved ? "Remove from favourites" : "Save to favourites"
  );

  favoriteButton.title = saved
    ? "Remove from favourites"
    : "Save to favourites";
}

function toggleFavorite(quote) {
  if (!quote) return;

  let favorites = getFavorites();

  const index = favorites.findIndex(item =>
    item.quote === quote.quote &&
    item.author === quote.author
  );

  if (index >= 0) {
    favorites.splice(index, 1);
    showToast("Removed from your favourites.");
  } else {
    favorites.unshift({
      quote: quote.quote,
      author: quote.author,
      wallpaper: quote.wallpaper,
      savedAt: new Date().toISOString()
    });

    showToast("Saved to your favourites! 💖");
  }

  if (writeStorage(STORAGE_KEYS.favorites, favorites)) {
    renderFavorites();
    updateFavoriteButton();
  }
}

function renderFavorites() {
  if (!favoritesList) return;

  const favorites = getFavorites();

  if (favoriteCount) {
    favoriteCount.textContent = `${favorites.length} SAVED`;
  }

  if (navFavoriteCount) {
    navFavoriteCount.textContent = favorites.length;
  }

  if (favorites.length === 0) {
    favoritesList.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">♡</span>
        <h3>Your favourites live here!</h3>
        <p>Tap the heart on any quote to save a little inspiration.</p>
      </div>
    `;
    return;
  }

  favoritesList.innerHTML = favorites.map((item, index) => `
    <article class="mini-card">
      <div>
        <p class="mini-quote">“${escapeHTML(item.quote)}”</p>
        <p class="mini-author">— ${escapeHTML(item.author)}</p>
      </div>

      <div class="mini-actions">
        <button type="button" data-action="view-favorite"
          data-index="${index}">View vibe ↗</button>
        <button type="button" data-action="remove-favorite"
          data-index="${index}">♥ Remove</button>
      </div>
    </article>
  `).join("");
}

/* ---------- HISTORY ---------- */

function saveToHistory(quote) {
  if (!quote) return;

  let history = getHistory();

  history = history.filter(item =>
    item.quote !== quote.quote ||
    item.author !== quote.author
  );

  history.unshift({
    quote: quote.quote,
    author: quote.author,
    wallpaper: quote.wallpaper,
    generatedAt: quote.generatedAt
  });

  history = history.slice(0, MAX_HISTORY);

  writeStorage(STORAGE_KEYS.history, history);
}

function renderHistory() {
  if (!historyList) return;

  const history = getHistory();

  if (history.length === 0) {
    historyList.innerHTML = `
      <div class="empty-state">
        Your discoveries will appear here after you generate a vibe.
      </div>
    `;
    return;
  }

  historyList.innerHTML = history.map((item, index) => `
    <article class="history-item">
      <div>
        <p>“${escapeHTML(item.quote)}”</p>
        <small>— ${escapeHTML(item.author)}</small>
      </div>

      <button type="button" data-action="view-history"
        data-index="${index}">View ↗</button>
    </article>
  `).join("");
}

function restoreQuote(item) {
  if (!item) return;

  currentQuote = {
    id: `${Date.now()}-restored`,
    quote: item.quote,
    author: item.author,
    wallpaper: isValidWallpaper(item.wallpaper)
      ? item.wallpaper
      : "https://picsum.photos/seed/vibeverse-restored/1920/1080",
    generatedAt: item.generatedAt || new Date().toISOString()
  };

  renderCurrentQuote();

  document.getElementById("generator").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });

  showToast("Your selected vibe is ready! ✨");
}

/* ---------- COPY QUOTE ---------- */

async function copyQuote() {
  if (!currentQuote) {
    showToast("Generate a quote first!");
    return;
  }

  const text = `"${currentQuote.quote}" — ${currentQuote.author}`;

  try {
    await navigator.clipboard.writeText(text);
    showToast("Quote copied to clipboard! 📋");
  } catch (error) {
    const temporary = document.createElement("textarea");

    temporary.value = text;
    temporary.setAttribute("readonly", "");
    temporary.style.position = "fixed";
    temporary.style.opacity = "0";

    document.body.appendChild(temporary);
    temporary.select();

    try {
      const successful = document.execCommand("copy");

      if (successful) {
        showToast("Quote copied to clipboard! 📋");
      } else {
        showToast("Copy failed. Please select and copy the quote.");
      }
    } catch {
      showToast("Copy failed. Please copy the quote manually.");
    } finally {
      temporary.remove();
    }
  }
}

/* ---------- SHARE QUOTE ---------- */

async function shareQuote() {
  if (!currentQuote) {
    showToast("Generate a quote first!");
    return;
  }

  const text = `"${currentQuote.quote}" — ${currentQuote.author}`;

  if (navigator.share) {
    try {
      await navigator.share({
        title: "A little inspiration from VibeVerse",
        text
      });
    } catch (error) {
      if (error.name !== "AbortError") {
        showToast("Sharing was unavailable. Try copying the quote.");
      }
    }
  } else {
    try {
      await navigator.clipboard.writeText(text);
      showToast("Sharing isn't supported here. Quote copied instead!");
    } catch {
      showToast("Please use Copy quote to share your inspiration.");
    }
  }
}

/* ---------- WALLPAPER ---------- */

function openWallpaper() {
  if (!currentQuote) {
    showToast("Generate a vibe first!");
    return;
  }

  if (!isValidWallpaper(currentQuote.wallpaper)) {
    showToast("This wallpaper URL is not valid.");
    return;
  }

  window.open(
    currentQuote.wallpaper,
    "_blank",
    "noopener,noreferrer"
  );

  showToast("Wallpaper opened in a new tab. Save it from there! 🖼️");
}

/* ---------- CLICK EVENTS ---------- */

generateButton.addEventListener("click", generateQuote);

favoriteButton.addEventListener("click", () => {
  toggleFavorite(currentQuote);
});

copyButton.addEventListener("click", copyQuote);

shareButton.addEventListener("click", shareQuote);

wallpaperButton.addEventListener("click", openWallpaper);

favoritesList.addEventListener("click", event => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const index = Number(button.dataset.index);
  const favorites = getFavorites();

  if (!Number.isInteger(index) || index < 0 || index >= favorites.length) {
    return;
  }

  if (button.dataset.action === "remove-favorite") {
    const updated = favorites.filter((_, i) => i !== index);

    if (writeStorage(STORAGE_KEYS.favorites, updated)) {
      renderFavorites();
      updateFavoriteButton();
      showToast("Favourite removed.");
    }
  }

  if (button.dataset.action === "view-favorite") {
    restoreQuote(favorites[index]);
  }
});

historyList.addEventListener("click", event => {
  const button = event.target.closest("button[data-action]");
  if (!button || button.dataset.action !== "view-history") return;

  const index = Number(button.dataset.index);
  const history = getHistory();

  if (Number.isInteger(index) && index >= 0 && index < history.length) {
    restoreQuote(history[index]);
  }
});

clearHistoryButton.addEventListener("click", () => {
  const history = getHistory();

  if (history.length === 0) {
    showToast("Your history is already empty.");
    return;
  }

  if (confirm("Are you sure you want to clear your quote history?")) {
    if (writeStorage(STORAGE_KEYS.history, [])) {
      renderHistory();
      showToast("Your history has been cleared.");
    }
  }
});

/* ---------- INITIALIZE ---------- */

function initializeApp() {
  renderFavorites();
  renderHistory();
  generateQuote();
}

initializeApp();

/* ==========================================
   VIBEVERSE ACCOUNT + SEARCH FEATURES
   Add below your existing script.js code
========================================== */

const AUTH_TOKEN_KEY = "vibeverse_auth_token";

let authMode = "register";
let searchResultsData = [];

const authForm = document.getElementById("authForm");
const authName = document.getElementById("authName");
const authEmail = document.getElementById("authEmail");
const authPhone = document.getElementById("authPhone");
const authPassword = document.getElementById("authPassword");
const authSubmit = document.getElementById("authSubmit");
const authModeButton = document.getElementById("authModeButton");
const authMessage = document.getElementById("authMessage");
const nameField = document.getElementById("nameField");
const phoneField = document.getElementById("phoneField");
const loggedInPanel = document.getElementById("loggedInPanel");
const welcomeMessage = document.getElementById("welcomeMessage");
const logoutButton = document.getElementById("logoutButton");

const quoteSearchForm = document.getElementById("quoteSearchForm");
const quoteSearchInput = document.getElementById("quoteSearchInput");
const searchMessage = document.getElementById("searchMessage");
const searchResults = document.getElementById("searchResults");

function getAuthToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

function setAuthMode(mode) {
  authMode = mode;

  const registering = mode === "register";

  nameField.hidden = !registering;
  phoneField.hidden = !registering;

  authName.required = registering;

  authPassword.autocomplete = registering
    ? "new-password"
    : "current-password";

  authSubmit.textContent = registering
    ? "✨ Create Account"
    : "💜 Log In";

  authModeButton.textContent = registering
    ? "Already have an account? Log in"
    : "New to VibeVerse? Create an account";

  authMessage.textContent = "";
}

authModeButton.addEventListener("click", () => {
  setAuthMode(authMode === "register" ? "login" : "register");
});

authForm.addEventListener("submit", async event => {
  event.preventDefault();

  const payload = {
    email: authEmail.value.trim(),
    password: authPassword.value
  };

  if (authMode === "register") {
    payload.name = authName.value.trim();
    payload.phone = authPhone.value.trim();
  }

  authSubmit.disabled = true;
  authSubmit.textContent = "Please wait...";
  authMessage.textContent = "";

  try {
    const endpoint = authMode === "register"
      ? "/api/auth/register"
      : "/api/auth/login";

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Authentication failed.");
    }

    localStorage.setItem(AUTH_TOKEN_KEY, data.token);

    showLoggedInUser(data.user);
    authForm.reset();
    authMessage.textContent = data.message;

    showToast(data.message || "Welcome to VibeVerse! 💖");
  } catch (error) {
    authMessage.textContent = error.message;
  } finally {
    authSubmit.disabled = false;
    setAuthMode(authMode);
  }
});

function showLoggedInUser(user) {
  if (!user) return;

  loggedInPanel.hidden = false;
  authForm.hidden = true;
  authModeButton.hidden = true;

  welcomeMessage.textContent = `Welcome, ${user.name}! 🌈`;
  authMessage.textContent = "You are logged in.";
}

function showLoggedOut() {
  localStorage.removeItem(AUTH_TOKEN_KEY);

  loggedInPanel.hidden = true;
  authForm.hidden = false;
  authModeButton.hidden = false;

  setAuthMode("register");
}

logoutButton.addEventListener("click", () => {
  showLoggedOut();
  showToast("You have logged out.");
});

async function checkExistingLogin() {
  const token = getAuthToken();

  if (!token) return;

  try {
    const response = await fetch("/api/auth/me", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      showLoggedOut();
      return;
    }

    const data = await response.json();
    showLoggedInUser(data.user);
  } catch (error) {
    authMessage.textContent =
      "Could not check your session. Please check your connection.";
  }
}

/* ---------- QUOTE SEARCH ---------- */

quoteSearchForm.addEventListener("submit", async event => {
  event.preventDefault();

  const query = quoteSearchInput.value.trim();

  if (query.length < 2) {
    searchMessage.textContent =
      "Please enter at least 2 characters.";
    return;
  }

  searchMessage.textContent = "🔎 Finding quotes...";
  searchResults.innerHTML = "";

  try {
    const response = await fetch(
      `/api/search?q=${encodeURIComponent(query)}`
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Search failed.");
    }

    searchResultsData = data.results || [];

    if (searchResultsData.length === 0) {
      searchMessage.textContent =
        "No matching quotes found. Try motivation, life, success, or happiness.";
      return;
    }

    searchMessage.textContent =
      `✨ Found ${searchResultsData.length} matching quote(s).`;

    searchResults.innerHTML = searchResultsData.map((item, index) => `
      <article class="search-result-card">
        <p>“${escapeHTML(item.quote)}”</p>
        <small>— ${escapeHTML(item.author)}</small>
        <div>
          <button type="button" data-search-index="${index}">
            Use this quote ✨
          </button>
        </div>
      </article>
    `).join("");
  } catch (error) {
    searchMessage.textContent =
      "Search is unavailable. Check that the backend is running.";
  }
});

searchResults.addEventListener("click", event => {
  const button = event.target.closest("[data-search-index]");

  if (!button) return;

  const index = Number(button.dataset.searchIndex);
  const item = searchResultsData[index];

  if (!item) return;

  currentQuote = {
    id: `${Date.now()}-search`,
    quote: item.quote,
    author: item.author,
    wallpaper:
      `https://picsum.photos/seed/vibeverse-${Date.now()}/1920/1080`,
    generatedAt: new Date().toISOString()
  };

  renderCurrentQuote();
  saveToHistory(currentQuote);
  renderFavorites();
  renderHistory();

  document.getElementById("generator").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });

  showToast("Your selected quote is ready! 💖");
});

// Restore the session if the user has already logged in
checkExistingLogin();

/* =====================================
   VIBEVERSE — WALLPAPER DESIGNER
===================================== */

(() => {
    const canvas = document.getElementById("wallpaperPreview");
    const previewButton = document.getElementById("previewWallpaperButton");
    const downloadButton = document.getElementById("downloadWallpaperButton");
    const fontSelect = document.getElementById("wallpaperFont");
    const positionSelect = document.getElementById("wallpaperPosition");
    const previewMessage = document.getElementById("wallpaperPreviewMessage");

    const wallpaperCard = document.getElementById("wallpaperCard");
    const quoteElement = document.getElementById("quoteText");
    const authorElement = document.getElementById("quoteAuthor");

    if (
        !canvas || !previewButton || !downloadButton ||
        !fontSelect || !positionSelect || !previewMessage ||
        !wallpaperCard || !quoteElement || !authorElement
    ) {
        console.error("VibeVerse Wallpaper Designer: Required HTML elements are missing.");
        return;
    }

    const ctx = canvas.getContext("2d");
    let previewReady = false;

    function getBackgroundUrl() {
        const background =
            getComputedStyle(wallpaperCard).backgroundImage ||
            wallpaperCard.style.backgroundImage;

        const match = background.match(/url\(["']?(.*?)["']?\)/);

        return match ? match[1] : null;
    }

    function wrapText(text, maxWidth, fontSize, fontFamily) {
        ctx.font = `${fontSize}px "${fontFamily}"`;

        const words = text.trim().split(/\s+/);
        const lines = [];
        let line = "";

        words.forEach((word) => {
            const testLine = line ? `${line} ${word}` : word;

            if (ctx.measureText(testLine).width > maxWidth && line) {
                lines.push(line);
                line = word;
            } else {
                line = testLine;
            }
        });

        if (line) {
            lines.push(line);
        }

        return lines;
    }

    function drawWallpaper(image) {
        const width = canvas.width;
        const height = canvas.height;

        // Draw the background image using a cover layout.
        const scale = Math.max(
            width / image.width,
            height / image.height
        );

        const imageWidth = image.width * scale;
        const imageHeight = image.height * scale;

        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(
            image,
            (width - imageWidth) / 2,
            (height - imageHeight) / 2,
            imageWidth,
            imageHeight
        );

        // Add a dark overlay to make the quote readable.
        const overlay = ctx.createLinearGradient(0, 0, width, height);
        overlay.addColorStop(0, "rgba(15, 8, 30, 0.42)");
        overlay.addColorStop(1, "rgba(15, 8, 30, 0.72)");

        ctx.fillStyle = overlay;
        ctx.fillRect(0, 0, width, height);

        const quote = quoteElement.textContent.trim();
        const author = authorElement.textContent.trim();
        const fontFamily = fontSelect.value;

        if (!quote) {
            throw new Error("Generate a quote before creating your wallpaper.");
        }

        const maxTextWidth = width * 0.76;
        const fontSize = 66;
        const lineHeight = 92;
        const lines = wrapText(
            `“${quote}”`,
            maxTextWidth,
            fontSize,
            fontFamily
        );

        // Keep long quotes readable.
        const adjustedFontSize = lines.length > 5 ? 50 : fontSize;
        const adjustedLineHeight = adjustedFontSize * 1.4;

        const finalLines = wrapText(
            `“${quote}”`,
            maxTextWidth,
            adjustedFontSize,
            fontFamily
        );

        const authorFontSize = 32;
        const totalTextHeight =
            finalLines.length * adjustedLineHeight + 75;

        let startY = (height - totalTextHeight) / 2;

        if (positionSelect.value === "bottom") {
            startY = height - totalTextHeight - 110;
        }

        ctx.textBaseline = "top";
        ctx.fillStyle = "#ffffff";
        ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
        ctx.shadowBlur = 12;

        finalLines.forEach((line, index) => {
            ctx.font = `${adjustedFontSize}px "${fontFamily}"`;
            ctx.textAlign =
                positionSelect.value === "left" ? "left" : "center";

            const x =
                positionSelect.value === "left"
                    ? width * 0.12
                    : width / 2;

            ctx.fillText(
                line,
                x,
                startY + index * adjustedLineHeight,
                maxTextWidth
            );
        });

        // Draw the author below the quote.
        if (author) {
            ctx.shadowBlur = 5;
            ctx.font = `600 ${authorFontSize}px "DM Sans", sans-serif`;
            ctx.fillStyle = "#f3d5ff";

            const authorX =
                positionSelect.value === "left"
                    ? width * 0.12
                    : width / 2;

            ctx.textAlign =
                positionSelect.value === "left" ? "left" : "center";

            ctx.fillText(
                `— ${author}`,
                authorX,
                startY + finalLines.length * adjustedLineHeight + 28,
                maxTextWidth
            );
        }

        // Reset shadow settings.
        ctx.shadowBlur = 0;
        ctx.shadowColor = "transparent";

        previewReady = true;
        previewMessage.textContent =
            "✨ Your wallpaper preview is ready! You can now download it.";
    }

    async function createPreview() {
        const quote = quoteElement.textContent.trim();
        const backgroundUrl = getBackgroundUrl();

        if (!quote || !backgroundUrl) {
            previewReady = false;
            previewMessage.textContent =
                "Generate a quote and wallpaper first, then update the preview.";
            return false;
        }

        previewMessage.textContent = "Creating your wallpaper preview…";

        try {
            if (document.fonts && document.fonts.load) {
                await Promise.all([
                    document.fonts.load(`66px "${fontSelect.value}"`),
                    document.fonts.load('32px "DM Sans"')
                ]);
            }

            const image = new Image();

            // Required for canvas export when the image host supports CORS.
            image.crossOrigin = "anonymous";

            await new Promise((resolve, reject) => {
                image.onload = resolve;
                image.onerror = () => reject(
                    new Error("Could not load the background image.")
                );
                image.src = backgroundUrl;
            });

            drawWallpaper(image);
            return true;
        } catch (error) {
            previewReady = false;
            previewMessage.textContent =
                error.message ||
                "Unable to create the preview. Please try another wallpaper.";
            console.error("Wallpaper preview error:", error);
            return false;
        }
    }

    previewButton.addEventListener("click", createPreview);

    downloadButton.addEventListener("click", async () => {
        if (!previewReady) {
            const success = await createPreview();

            if (!success) {
                return;
            }
        }

        try {
            canvas.toBlob((blob) => {
                if (!blob) {
                    previewMessage.textContent =
                        "Could not create the download. Please try again.";
                    return;
                }

                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");

                link.href = url;
                link.download = "vibeverse-desktop-wallpaper.png";

                document.body.appendChild(link);
                link.click();
                link.remove();

                setTimeout(() => URL.revokeObjectURL(url), 1000);

                previewMessage.textContent =
                    "Your HD wallpaper download has started! 🎉";
            }, "image/png");
        } catch (error) {
            previewMessage.textContent =
                "The background image may block downloading. Try another image.";
            console.error("Wallpaper download error:", error);
        }
    });

    // Require a fresh preview after changing the design options.
    fontSelect.addEventListener("change", () => {
        previewReady = false;
        previewMessage.textContent =
            "Font changed. Click Update Preview to apply it.";
    });

    positionSelect.addEventListener("change", () => {
        previewReady = false;
        previewMessage.textContent =
            "Position changed. Click Update Preview to apply it.";
    });
})();

/* =====================================
   VIBEVERSE — MOOD & PERSONAL JOURNAL
===================================== */

(() => {
  const moodButtons = document.querySelectorAll(".mood-option");
  const moodResults = document.getElementById("moodQuoteResults");
  const moodMessage = document.getElementById("moodMessage");

  const journalForm = document.getElementById("journalForm");
  const journalTitle = document.getElementById("journalTitle");
  const journalReflection = document.getElementById("journalReflection");
  const journalQuote = document.getElementById("journalQuote");
  const journalAuthor = document.getElementById("journalAuthor");
  const journalMessage = document.getElementById("journalMessage");
  const journalEntries = document.getElementById("journalEntries");
  const refreshJournalButton = document.getElementById("refreshJournalButton");
  const saveJournalButton = document.getElementById("saveJournalButton");

  if (!moodResults || !journalForm || !journalEntries) return;

  const moodQuotes = {
    happy: [
      { quote: "Happiness grows when you notice the little things.", author: "VibeVerse" },
      { quote: "Let your joy be louder than your worries.", author: "VibeVerse" },
      { quote: "Collect moments that make your heart smile.", author: "VibeVerse" }
    ],
    sad: [
      { quote: "You are allowed to have difficult days and still be making progress.", author: "VibeVerse" },
      { quote: "Even the longest night gives way to morning.", author: "VibeVerse" },
      { quote: "Be gentle with yourself; healing takes time.", author: "VibeVerse" }
    ],
    stressed: [
      { quote: "Pause. Breathe. You do not have to solve everything at once.", author: "VibeVerse" },
      { quote: "One calm step is still a step forward.", author: "VibeVerse" },
      { quote: "Give yourself permission to slow down.", author: "VibeVerse" }
    ],
    motivated: [
      { quote: "Small steps taken consistently create remarkable change.", author: "VibeVerse" },
      { quote: "Start where you are. Use what you have. Do what you can.", author: "Arthur Ashe" },
      { quote: "Your future is shaped by what you choose to do today.", author: "VibeVerse" }
    ],
    peaceful: [
      { quote: "Make room for quiet; not every moment needs an answer.", author: "VibeVerse" },
      { quote: "Peace begins when you stop fighting every little thing.", author: "VibeVerse" },
      { quote: "Let this moment be enough.", author: "VibeVerse" }
    ]
  };

  function getAuthToken() {
    return localStorage.getItem("vibeverse_auth_token");
  }

  function showMoodQuotes(mood) {
    moodResults.replaceChildren();

    const quotes = moodQuotes[mood] || moodQuotes.happy;

    quotes.forEach((item) => {
      const card = document.createElement("article");
      card.className = "mood-quote-card";

      const quote = document.createElement("blockquote");
      quote.textContent = `“${item.quote}”`;

      const author = document.createElement("p");
      author.className = "mood-author";
      author.textContent = `— ${item.author}`;

      const useButton = document.createElement("button");
      useButton.type = "button";
      useButton.textContent = "Use this quote";

      useButton.addEventListener("click", () => {
        const quoteText = document.getElementById("quoteText");
        const quoteAuthor = document.getElementById("quoteAuthor");

        if (quoteText) quoteText.textContent = item.quote;
        if (quoteAuthor) quoteAuthor.textContent = item.author;

        // Fill the journal fields too, so the user can save the quote.
        journalQuote.value = item.quote;
        journalAuthor.value = item.author;

        moodMessage.textContent =
          "Quote selected! You can save it in your personal journal.";

        document.getElementById("personalJournal")?.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      });

      card.append(quote, author, useButton);
      moodResults.appendChild(card);
    });
  }

  moodButtons.forEach((button) => {
    button.addEventListener("click", () => {
      moodButtons.forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      showMoodQuotes(button.dataset.mood);
      moodMessage.textContent = "";
    });
  });

  // Display the default mood immediately.
  showMoodQuotes("happy");

  function makeMessage(container, message) {
    container.textContent = message;
  }

  async function loadJournal() {
    const token = getAuthToken();

    if (!token) {
      journalEntries.replaceChildren();
      const message = document.createElement("p");
      message.textContent = "Please log in to view your saved journal entries.";
      journalEntries.appendChild(message);
      return;
    }

    journalEntries.textContent = "Loading your journal…";

    try {
      const response = await fetch("/api/journal", {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Could not load your journal.");
      }

      journalEntries.replaceChildren();

      if (!data.entries || data.entries.length === 0) {
        const emptyMessage = document.createElement("p");
        emptyMessage.textContent =
          "No journal entries yet. Save your first memory above. ✨";
        journalEntries.appendChild(emptyMessage);
        return;
      }

      data.entries.forEach((entry) => {
        const card = document.createElement("article");
        card.className = "journal-entry-card";

        const title = document.createElement("h4");
        title.textContent = entry.title;

        const date = document.createElement("p");
        date.className = "journal-entry-date";
        date.textContent = entry.createdAt
          ? new Date(entry.createdAt).toLocaleString()
          : "";

        const reflection = document.createElement("p");
        reflection.textContent = entry.reflection;

        card.append(title, date, reflection);

        if (entry.quote) {
          const quote = document.createElement("p");
          quote.className = "journal-quote";
          quote.textContent = `“${entry.quote}”`;

          if (entry.author) {
            quote.textContent += ` — ${entry.author}`;
          }

          card.appendChild(quote);
        }

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "journal-delete-button";
        deleteButton.textContent = "Delete entry";

        deleteButton.addEventListener("click", async () => {
          const confirmed = window.confirm(
            "Are you sure you want to delete this journal entry?"
          );

          if (!confirmed) return;

          try {
            const deleteResponse = await fetch(
              `/api/journal/${encodeURIComponent(entry._id)}`,
              {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
              }
            );

            const deleteData = await deleteResponse.json();

            if (!deleteResponse.ok) {
              throw new Error(deleteData.message || "Could not delete entry.");
            }

            makeMessage(journalMessage, "Journal entry deleted.");
            await loadJournal();
          } catch (error) {
            makeMessage(journalMessage, error.message);
          }
        });

        card.appendChild(deleteButton);
        journalEntries.appendChild(card);
      });
    } catch (error) {
      journalEntries.textContent = error.message;
    }
  }

  journalForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const token = getAuthToken();

    if (!token) {
      makeMessage(
        journalMessage,
        "Please log in first to save your personal journal."
      );
      return;
    }

    const payload = {
      title: journalTitle.value.trim(),
      reflection: journalReflection.value.trim(),
      quote: journalQuote.value.trim(),
      author: journalAuthor.value.trim()
    };

    if (!payload.title || !payload.reflection) {
      makeMessage(journalMessage, "Please enter a title and your thoughts.");
      return;
    }

    saveJournalButton.disabled = true;
    saveJournalButton.textContent = "Saving…";

    try {
      const response = await fetch("/api/journal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Could not save your entry.");
      }

      journalForm.reset();
      makeMessage(journalMessage, "Your journal entry has been saved! 💜");
      await loadJournal();
    } catch (error) {
      makeMessage(journalMessage, error.message);
    } finally {
      saveJournalButton.disabled = false;
      saveJournalButton.textContent = "♡ Save Journal Entry";
    }
  });

  refreshJournalButton.addEventListener("click", loadJournal);

  // Refresh when a user logs in or logs out elsewhere in this browser tab.
  window.addEventListener("storage", (event) => {
    if (event.key === "vibeverse_auth_token") {
      loadJournal();
    }
  });

  loadJournal();
})();