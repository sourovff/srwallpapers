import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getDatabase, ref, onValue, set, remove } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";

// ===== FIREBASE CONFIG =====
const firebaseConfig = {
  apiKey: "AIzaSyCuqFQSt-lkSzBgUS06v9YtR_jLu9Ms5Gg",
  authDomain: "wallpaper-f618c.firebaseapp.com",
  databaseURL: "https://wallpaper-f618c-default-rtdb.firebaseio.com",
  projectId: "wallpaper-f618c",
  storageBucket: "wallpaper-f618c.firebasestorage.app",
  messagingSenderId: "734224666313",
  appId: "1:734224666313:web:f27acf05e6471abcadc718"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// ===== STATE =====
let currentUser = null;
let allData = {};
let userFavorites = {};
let currentFilter = 'all';

// ===== DOM REFS =====
const authSection = document.getElementById('authSection');
const trendingGrid = document.getElementById('trendingGrid');
const latestGrid = document.getElementById('latestGrid');
const favoritesGrid = document.getElementById('favoritesGrid');
const favoritesSection = document.getElementById('favoritesSection');
const globalSearch = document.getElementById('globalSearch');
const favoritesNavLink = document.getElementById('favoritesNavLink');
const bottomFavoritesLink = document.getElementById('bottomFavoritesLink');

// ===== CATEGORIES =====
const categories = [
  { name: 'Nature', color1: '#065f46', color2: '#047857' },
  { name: 'Cars', color1: '#1e3a5f', color2: '#2563eb' },
  { name: 'Anime', color1: '#4c1d95', color2: '#7c3aed' },
  { name: 'Gaming', color1: '#831843', color2: '#db2777' },
  { name: 'Sports', color1: '#78350f', color2: '#d97706' },
  { name: 'Technology', color1: '#0c4a6e', color2: '#0ea5e9' },
  { name: 'Space', color1: '#1e1b4b', color2: '#8b5cf6' },
  { name: 'Animals', color1: '#14532d', color2: '#22c55e' },
  { name: 'Art & Design', color1: '#4c1d95', color2: '#a855f7' },
  { name: 'Travel', color1: '#1e3a5f', color2: '#38bdf8' },
  { name: 'Food', color1: '#78350f', color2: '#f59e0b' },
  { name: 'Architecture', color1: '#0c4a6e', color2: '#64748b' },
  { name: 'Fashion', color1: '#831843', color2: '#ec4899' },
  { name: 'Music', color1: '#4c1d95', color2: '#c084fc' },
  { name: 'Movies', color1: '#1e3a5f', color2: '#f43f5e' },
  { name: 'Health & Fitness', color1: '#14532d', color2: '#34d399' }
];

// ===== RENDER FUNCTIONS =====
function renderCard(item, id) {
  const isFav = currentUser && userFavorites[id];
  // URL যদি .mp4 দিয়ে শেষ হয় অথবা ডেটাবেজে isLive: true থাকে, তবেই লাইভ ওয়ালপেপার
  const isLive = item.imageUrl.endsWith('.mp4') || (item.isLive === true); 
  
  // লাইভ ওয়ালপেপারের থাম্বনেইল হিসেবে একটা ডামি টেক্সচার ব্যাকগ্রাউন্ড ব্যবহার করা হয়েছে
  const displayImg = isLive ? 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500' : item.imageUrl;

  return `
    <div class="card" data-id="${id}" data-url="${item.imageUrl}" data-title="${item.title || 'Untitled'}" data-res="${item.resolution || '4K Ultra HD'}" data-islive="${isLive}">
      ${isLive ? '<div class="video-badge"><i class="fas fa-video"></i> Live</div>' : ''}
      <img src="${displayImg}" alt="${item.title}" loading="lazy" />
      <div class="card-info" style="display:none;">
        <h4>${item.title || 'Untitled'}</h4>
        <div class="card-footer">
          <span class="badge">${item.resolution || '4K Ultra HD'}</span>
          <div class="card-actions">
            <i class="fas fa-download" onclick="event.stopPropagation(); downloadWallpaper('${item.imageUrl}')"></i>
            <i class="fa${isFav ? 's' : 'r'} fa-heart" onclick="event.stopPropagation(); toggleFavorite('${id}')"></i>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderCategories() {
  const grid = document.getElementById('categoryGrid');
  grid.innerHTML = categories.map(cat => `
    <div class="cat-card" style="background: linear-gradient(145deg, ${cat.color1}, ${cat.color2});" onclick="filterByTag('${cat.name}')">
      <div class="overlay"></div>
      <h3>${cat.name}</h3>
    </div>
  `).join('');
}

function renderAll(filter = currentFilter) {
  const entries = Object.entries(allData);
  let trending = [], latest = [];
  const reversed = entries.reverse();

  reversed.forEach(([id, item]) => {
    if (filter !== 'all' && item.tag !== filter && item.category !== filter) return;
    if (item.category === 'trending') trending.push([id, item]);
    else latest.push([id, item]);
  });

  trendingGrid.innerHTML = trending.length ? 
    trending.map(([id, item]) => renderCard(item, id)).join('') : 
    '<div class="empty-state"><i class="fas fa-fire"></i> No trending items</div>';

  latestGrid.innerHTML = latest.length ? 
    latest.map(([id, item]) => renderCard(item, id)).join('') : 
    '<div class="empty-state"><i class="fas fa-image"></i> No items found</div>';
}

function renderFavorites() {
  if (!currentUser) {
    favoritesGrid.innerHTML = '<div class="empty-state"><i class="fas fa-heart"></i> Sign in to see your favorites.</div>';
    return;
  }
  const entries = Object.entries(userFavorites);
  if (!entries.length) {
    favoritesGrid.innerHTML = '<div class="empty-state"><i class="fas fa-heart"></i> No favorites yet. Start saving!</div>';
    return;
  }
  favoritesGrid.innerHTML = entries.map(([id, item]) => renderCard(item, id)).join('');
}

function updateFavoritesVisibility(show) {
  if (show) {
    favoritesNavLink.style.display = 'inline';
    bottomFavoritesLink.style.display = 'flex';
    if(favoritesSection) favoritesSection.style.display = 'block';
  } else {
    favoritesNavLink.style.display = 'none';
    bottomFavoritesLink.style.display = 'none';
    if(favoritesSection) favoritesSection.style.display = 'none';
  }
}

// ===== SEARCH =====
window.performSearch = function() {
  const q = globalSearch.value.toLowerCase().trim();
  if (!q) { currentFilter = 'all'; renderAll(); return; }
  const filtered = {};
  Object.entries(allData).forEach(([id, item]) => {
    if ((item.title?.toLowerCase().includes(q)) || 
        (item.tag?.toLowerCase().includes(q)) || 
        (item.category?.toLowerCase().includes(q))) {
      filtered[id] = item;
    }
  });
  latestGrid.innerHTML = Object.entries(filtered).length ? 
    Object.entries(filtered).map(([id, item]) => renderCard(item, id)).join('') : 
    '<div class="empty-state"><i class="fas fa-search"></i> No results found</div>';
};

globalSearch.addEventListener('keydown', (e) => { 
  if (e.key === 'Enter') performSearch(); 
});

window.filterByTag = function(tag) {
  currentFilter = tag;
  globalSearch.value = '';
  renderAll(tag);
  document.getElementById('latestGrid').scrollIntoView({ behavior: 'smooth' });
};

// ===== FAVORITES =====
function loadFavorites(uid) {
  const favRef = ref(db, `favorites/${uid}`);
  onValue(favRef, (snap) => {
    userFavorites = snap.val() || {};
    renderFavorites();
    renderAll(currentFilter);
  });
}

window.toggleFavorite = function(id) {
  if (!currentUser) {
    showToast('🔑 Please sign in to save favorites.');
    return;
  }
  const item = allData[id];
  if (!item) return;
  const favRef = ref(db, `favorites/${currentUser.uid}/${id}`);
  if (userFavorites[id]) {
    remove(favRef);
    showToast('❤️ Removed from favorites');
  } else {
    set(favRef, { 
      imageUrl: item.imageUrl, 
      title: item.title, 
      resolution: item.resolution, 
      tag: item.tag 
    });
    showToast('❤️ Added to favorites');
  }
};

// ===== DOWNLOAD =====
window.downloadWallpaper = function(url) {
  if (!url) return;
  fetch(url)
    .then(res => res.blob())
    .then(blob => {
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'SRWallpaper_' + Date.now() + (url.endsWith('.mp4') ? '.mp4' : '.jpg');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      showToast('📥 Download started');
    })
    .catch(() => {
      window.open(url, '_blank');
      showToast('📥 Download started');
    });
};

// ===== AUTH =====
function updateAuthUI(user) {
  if (user) {
    currentUser = user;
    authSection.innerHTML = `
      <div class="user-profile" onclick="showProfileModal()">
        <img src="${user.photoURL || 'https://ui-avatars.com/api/?name=User&background=2563eb&color=fff'}" alt="avatar" />
        <span>${user.displayName || 'User'}</span>
        <button id="logoutBtn" onclick="event.stopPropagation();">Logout</button>
      </div>
    `;
    document.getElementById('logoutBtn').addEventListener('click', (e) => {
      e.stopPropagation();
      signOut(auth);
      showToast('👋 Logged out');
    });
    loadFavorites(user.uid);
    updateFavoritesVisibility(true);
  } else {
    currentUser = null;
    authSection.innerHTML = `
      <button id="loginBtn"><i class="fab fa-google"></i> Sign in</button>
    `;
    document.getElementById('loginBtn').addEventListener('click', () => {
      signInWithPopup(auth, provider).catch(err => showToast('❌ ' + err.message));
    });
    userFavorites = {};
    updateFavoritesVisibility(false);
    renderAll(currentFilter);
  }
}

onAuthStateChanged(auth, (user) => updateAuthUI(user));

window.showProfileModal = function() {
  if (!currentUser) { showToast('🔑 Please sign in first'); return; }
  document.getElementById('profileImg').src = currentUser.photoURL || 'https://ui-avatars.com/api/?name=User&background=2563eb&color=fff';
  document.getElementById('profileName').textContent = currentUser.displayName || 'User';
  document.getElementById('profileEmail').textContent = currentUser.email || 'No email';
  document.getElementById('profileUid').textContent = 'UID: ' + currentUser.uid;
  document.getElementById('profileModal').classList.add('show');
};

// ===== NAVIGATION =====
window.showSection = function(section) {
  document.querySelectorAll('.bottom-nav a').forEach(el => el.classList.remove('active'));
  if (section === 'home') {
    document.querySelector('.bottom-nav a:first-child')?.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else if (section === 'categories') {
    document.getElementById('categoryGrid').scrollIntoView({ behavior: 'smooth' });
  } else if (section === 'trending') {
    document.getElementById('trendingGrid').scrollIntoView({ behavior: 'smooth' });
  } else if (section === 'favorites') {
    if (!currentUser) { showToast('🔑 Please sign in first'); return; }
    favoritesSection.scrollIntoView({ behavior: 'smooth' });
    document.querySelector('.bottom-nav a:nth-child(4)')?.classList.add('active');
  } else if (section === 'profile') {
    showProfileModal();
  }
};

// ===== THEME TOGGLE =====
document.getElementById('themeToggle').addEventListener('click', function() {
  document.body.classList.toggle('light');
  this.classList.toggle('fa-sun');
});

window.addEventListener('scroll', function() {
  document.getElementById('scrollTop').classList.toggle('visible', window.scrollY > 400);
});

document.getElementById('scrollTop').addEventListener('click', () => 
  window.scrollTo({ top: 0, behavior: 'smooth' })
);

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._hide);
  t._hide = setTimeout(() => t.classList.remove('show'), 2800);
}
window.showToast = showToast;

// ===== MODAL LOGIC (LIVE WALLPAPER SUPPORT) =====
const modalOverlay = document.getElementById('modalOverlay');
const modalImg = document.getElementById('modalImg');
const modalVideo = document.getElementById('modalVideo');
const modalTitle = document.getElementById('modalTitle');
const modalRes = document.getElementById('modalRes');
let currentModalUrl = '';
let currentModalId = '';

document.addEventListener('click', function(e) {
  const card = e.target.closest('.card');
  if (!card) return;
  
  currentModalId = card.dataset.id;
  currentModalUrl = card.dataset.url;
  const isLive = card.dataset.islive === "true";
  
  modalTitle.textContent = card.dataset.title;
  modalRes.textContent = card.dataset.res || '4K Ultra HD';
  
  if (isLive) {
    modalImg.style.display = 'none';
    modalVideo.src = currentModalUrl;
    modalVideo.style.display = 'block';
    modalVideo.play();
  } else {
    modalVideo.style.display = 'none';
    modalVideo.src = '';
    modalImg.src = currentModalUrl;
    modalImg.style.display = 'block';
  }
  
  modalOverlay.classList.add('show');
});

const closeModal = () => {
  modalOverlay.classList.remove('show');
  modalVideo.pause();
  modalVideo.src = '';
};

document.getElementById('modalClose').addEventListener('click', closeModal);
modalOverlay.addEventListener('click', function(e) { 
  if (e.target === this) closeModal(); 
});

document.getElementById('modalDownload').addEventListener('click', () => {
  if (currentModalUrl) window.downloadWallpaper(currentModalUrl);
});

document.getElementById('modalShare').addEventListener('click', () => {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(currentModalUrl);
    showToast('🔗 Link copied to clipboard!');
  } else {
    showToast('❌ Failed to copy link');
  }
});

document.getElementById('modalFavorite').addEventListener('click', function() {
  if (currentModalId) {
    toggleFavorite(currentModalId);
  }
});

// ===== FIREBASE DATA =====
const dbRef = ref(db, 'wallpapers');
onValue(dbRef, (snapshot) => {
  allData = snapshot.val() || {};
  renderCategories();
  renderAll();
});

// ===== INIT =====
renderCategories();
updateFavoritesVisibility(false);
