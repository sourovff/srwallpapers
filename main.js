import { db, auth, provider } from './firebase-config.js';
import { ref, onValue, set, remove, push } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js";
import { signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";

let currentUser = null;
let currentUserData = null;
let allData = {};
let userFavorites = {};
let userDownloads = {};
let activeUrl = '', activeId = '';
let activeItem = null;
let selectedMethod = 'bkash';

// ===== TABS =====
const homePage = document.getElementById('homePage');
const favoritesPage = document.getElementById('favoritesPage');
const searchPopup = document.getElementById('searchPopup');
const profileModal = document.getElementById('profileModal');

function resetTabs() {
  document.querySelectorAll('.bottom-nav a').forEach(el => el.classList.remove('active'));
}

document.getElementById('navHome').addEventListener('click', function() {
  resetTabs(); this.classList.add('active');
  homePage.style.display = 'block';
  favoritesPage.style.display = 'none';
});

document.getElementById('navSearch').addEventListener('click', function() {
  searchPopup.classList.add('show');
  document.getElementById('popupSearchInput').focus();
});

document.getElementById('closeSearchBtn').addEventListener('click', () => searchPopup.classList.remove('show'));

document.getElementById('navFavs').addEventListener('click', function() {
  resetTabs(); this.classList.add('active');
  homePage.style.display = 'none';
  favoritesPage.style.display = 'block';
  renderFavorites();
});

document.getElementById('navProfile').addEventListener('click', function() {
  profileModal.classList.add('show');
});

// ===== CARD BUILDER =====
function createCardMarkup(item, id) {
  const isLive = item.imageUrl?.endsWith('.mp4') || item.isLive === true;
  const thumb = isLive ? 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500' : item.imageUrl;
  const downloads = item.downloads || 0;
  const isPremium = item.isPremium === true;
  
  return `
    <div class="card" data-id="${id}" data-url="${item.imageUrl}" data-title="${item.title || 'Untitled'}" 
         data-res="${item.resolution || '4K Ultra HD'}" data-tag="${item.tag || 'Nature'}" 
         data-downloads="${downloads}" data-islive="${isLive}" data-premium="${isPremium}">
      ${isLive ? '<div class="video-badge"><i class="fas fa-video"></i> Live</div>' : ''}
      ${isPremium ? '<div class="premium-badge-card">👑 Premium</div>' : ''}
      <div class="download-badge"><i class="fas fa-download"></i> ${downloads}</div>
      <img src="${thumb}" alt="${item.title || 'Wallpaper'}" loading="lazy" />
      ${isPremium ? `
        <div class="premium-lock-overlay">
          <i class="fas fa-crown"></i>
          <span>Premium Content</span>
        </div>
      ` : ''}
      <div class="overlay-info">
        <div class="title">${item.title || 'Untitled'}</div>
        <div class="tag">${item.tag || 'Untagged'}</div>
      </div>
    </div>
  `;
}

function renderGrids() {
  const entries = Object.entries(allData).reverse();
  let trendingHtml = '', latestHtml = '';

  entries.forEach(([id, item]) => {
    const html = createCardMarkup(item, id);
    if (item.category === 'trending') trendingHtml += html;
    else latestHtml += html;
  });

  document.getElementById('trendingGrid').innerHTML = trendingHtml || '<div class="empty-state">No trending items.</div>';
  document.getElementById('latestGrid').innerHTML = latestHtml || '<div class="empty-state">No items found.</div>';
}

function renderFavorites() {
  if (!currentUser) {
    document.getElementById('favoritesGrid').innerHTML = '<div class="empty-state"><i class="fas fa-lock"></i> Sign in to view your favorites!</div>';
    return;
  }
  const favs = Object.entries(userFavorites);
  if(!favs.length) {
    document.getElementById('favoritesGrid').innerHTML = '<div class="empty-state"><i class="fas fa-heart"></i> No favorites yet.</div>';
    return;
  }
  document.getElementById('favoritesGrid').innerHTML = favs.map(([id, item]) => createCardMarkup(item, id)).join('');
}

// ===== SEARCH =====
document.getElementById('popupSearchInput').addEventListener('input', function() {
  const query = this.value.toLowerCase().trim();
  const grid = document.getElementById('searchResultGrid');
  if(!query) {
    grid.innerHTML = '<div class="empty-state"><i class="fas fa-search"></i> Type something...</div>';
    return;
  }
  const match = Object.entries(allData).filter(([id, item]) => {
    return (item.title && item.title.toLowerCase().includes(query)) ||
           (item.tag && item.tag.toLowerCase().includes(query));
  });
  if(!match.length) {
    grid.innerHTML = '<div class="empty-state"><i class="fas fa-sad-tear"></i> No wallpapers found.</div>';
    return;
  }
  grid.innerHTML = match.map(([id, item]) => createCardMarkup(item, id)).join('');
});

// ===== MODAL =====
function openModal(id, item) {
  activeId = id;
  activeItem = item;
  activeUrl = item.imageUrl;
  const isLive = item.imageUrl?.endsWith('.mp4') || item.isLive === true;
  const isPremium = item.isPremium === true;

  document.getElementById('modalTitle').textContent = item.title || 'Untitled';
  document.getElementById('modalRes').textContent = item.resolution || '4K Ultra HD';
  document.getElementById('modalTag').textContent = item.tag || 'Untagged';
  document.getElementById('modalDownloads').innerHTML = `<i class="fas fa-download"></i> ${item.downloads || 0} downloads`;

  const badge = document.getElementById('modalPremiumBadge');
  badge.style.display = isPremium ? 'inline-block' : 'none';

  const notice = document.getElementById('premiumUpgradeNotice');
  const downloadBtn = document.getElementById('modalDownload');
  
  if (isPremium && (!currentUser || !currentUserData?.isPremium)) {
    notice.style.display = 'block';
    downloadBtn.disabled = true;
    downloadBtn.innerHTML = '<i class="fas fa-lock"></i> Premium Only';
  } else {
    notice.style.display = 'none';
    downloadBtn.disabled = false;
    downloadBtn.innerHTML = '<i class="fas fa-download"></i> Download';
  }

  if(isLive) {
    document.getElementById('modalImg').style.display = 'none';
    const v = document.getElementById('modalVideo'); v.src = activeUrl; v.style.display = 'block'; v.play();
  } else {
    document.getElementById('modalVideo').style.display = 'none';
    const img = document.getElementById('modalImg'); img.src = activeUrl; img.style.display = 'block';
  }
  document.getElementById('modalOverlay').classList.add('show');
}

document.addEventListener('click', function(e) {
  const card = e.target.closest('.card');
  if (!card) return;
  const id = card.dataset.id;
  const item = allData[id];
  if (item) openModal(id, item);
});

document.getElementById('modalClose').addEventListener('click', () => {
  document.getElementById('modalOverlay').classList.remove('show');
  document.getElementById('modalVideo').pause();
});

// ===== UPGRADE BUTTON =====
document.getElementById('modalUpgradeBtn').addEventListener('click', function() {
  profileModal.classList.add('show');
  document.getElementById('modalOverlay').classList.remove('show');
});

// ===== DOWNLOAD =====
document.getElementById('modalDownload').addEventListener('click', function() {
  if (!activeUrl) return;
  if (activeItem?.isPremium && (!currentUser || !currentUserData?.isPremium)) {
    showToast('👑 This is a Premium wallpaper. Upgrade to download!');
    return;
  }
  
  let fUrl = activeUrl.replace('/upload/', '/upload/fl_attachment/');
  const a = document.createElement('a');
  a.href = fUrl; a.target = '_blank'; a.download = 'SR_' + Date.now();
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  
  if (activeId && allData[activeId]) {
    const current = allData[activeId].downloads || 0;
    set(ref(db, `wallpapers/${activeId}/downloads`), current + 1);
    
    if (currentUser) {
      const uid = currentUser.uid;
      const dlRef = ref(db, `downloads/${uid}/${activeId}`);
      set(dlRef, { 
        title: allData[activeId].title, 
        downloadedAt: Date.now(),
        imageUrl: allData[activeId].imageUrl
      });
    }
  }
  showToast('📥 Download started!');
});

// ===== FAVORITE =====
document.getElementById('modalFavorite').addEventListener('click', function() {
  if (!currentUser) { showToast('🔑 Login required.'); return; }
  if (!activeId || !allData[activeId]) return;
  const item = allData[activeId];
  const refPath = ref(db, `favorites/${currentUser.uid}/${activeId}`);
  if(userFavorites[activeId]) {
    remove(refPath).then(() => showToast('❤️ Removed from favorites'));
  } else {
    set(refPath, { imageUrl: item.imageUrl, title: item.title, resolution: item.resolution, tag: item.tag })
      .then(() => showToast('❤️ Saved to favorites!'));
  }
});

// ===== SHARE =====
document.getElementById('modalShare').addEventListener('click', function() {
  if (navigator.share) {
    navigator.share({
      title: document.getElementById('modalTitle').textContent,
      text: 'Check out this wallpaper from SRWallpapers!',
      url: activeUrl
    }).catch(() => {});
  } else {
    navigator.clipboard.writeText(activeUrl).then(() => showToast('📋 Link copied!'));
  }
});

// ===== GET BADGES =====
function getBadges(downloadCount) {
  const badges = [];
  if (downloadCount >= 5) badges.push({ icon: '🥉', label: 'Bronze' });
  if (downloadCount >= 20) badges.push({ icon: '🥈', label: 'Silver' });
  if (downloadCount >= 50) badges.push({ icon: '🥇', label: 'Gold' });
  if (downloadCount >= 100) badges.push({ icon: '💎', label: 'Diamond' });
  if (downloadCount >= 500) badges.push({ icon: '👑', label: 'Royal' });
  return badges;
}

// ===== PAYMENT SYSTEM =====
window.selectMethod = function(method) {
  selectedMethod = method;
  document.querySelectorAll('.payment-method-item').forEach(el => el.classList.remove('selected'));
  document.getElementById(method + 'Method').classList.add('selected');
  document.getElementById('selectedMethodDisplay').textContent = method.toUpperCase();
};

window.submitPayment = async function() {
  const transactionId = document.getElementById('transactionId').value.trim();
  const phoneNumber = document.getElementById('senderPhone').value.trim();
  
  if (!transactionId || !phoneNumber) {
    showToast('❌ Please fill all fields');
    return;
  }
  
  const user = auth.currentUser;
  if (!user) {
    showToast('🔑 Please login first');
    return;
  }
  
  const amount = 100;
  
  const paymentData = {
    userId: user.uid,
    userEmail: user.email,
    userName: user.displayName || 'Unknown',
    amount: amount,
    transactionId: transactionId,
    phoneNumber: phoneNumber,
    method: selectedMethod,
    status: 'pending',
    package: 'yearly',
    createdAt: Date.now()
  };
  
  try {
    const paymentRef = push(ref(db, 'payments'));
    await set(paymentRef, paymentData);
    
    showToast('✅ Payment submitted! Admin will verify within 24 hours.');
    
    document.getElementById('transactionId').value = '';
    document.getElementById('senderPhone').value = '';
    
    const tgMessage = `📨 *New Payment Request!*\n\n👤 User: ${user.displayName}\n📧 Email: ${user.email}\n🆔 User ID: \`${user.uid}\`\n📦 Package: Yearly\n💰 Amount: ৳${amount}\n📱 Method: ${selectedMethod.toUpperCase()}\n🔑 TrxID: ${transactionId}\n📞 Phone: ${phoneNumber}`;
    const tgUrl = `https://t.me/sourov_ray?text=${encodeURIComponent(tgMessage)}`;
    
    document.getElementById('paymentStatus').innerHTML = `
      <div style="margin-top:12px; padding:14px; background:rgba(16,185,129,0.1); border:1px solid rgba(16,185,129,0.2); border-radius:14px;">
        <p style="color:#10b981; font-size:0.9rem; font-weight:600;">✅ Payment submitted successfully!</p>
        <p style="color:#94a3b8; font-size:0.75rem; margin-top:6px;">
          📨 Notify admin on Telegram: 
          <a href="${tgUrl}" target="_blank" style="color:#0088cc; font-weight:600; display:inline-flex; align-items:center; gap:6px;">
            <i class="fab fa-telegram-plane"></i> Send Message
          </a>
        </p>
        <div style="margin-top:8px; padding:8px; background:rgba(255,255,255,0.03); border-radius:8px;">
          <span style="font-size:0.65rem; color:#64748b;">Your User ID:</span>
          <span style="font-size:0.7rem; color:#60a5fa; font-family:monospace; font-weight:600;">${user.uid}</span>
          <button onclick="navigator.clipboard.writeText('${user.uid}')" style="background:rgba(255,255,255,0.05); border:none; color:#94a3b8; padding:2px 8px; border-radius:6px; cursor:pointer; font-size:0.6rem;">
            <i class="fas fa-copy"></i> Copy
          </button>
        </div>
      </div>
    `;
    
  } catch (error) {
    showToast('❌ Error: ' + error.message);
  }
};

// ===== PROFILE UI =====
function renderProfileUI(user, userData) {
  const container = document.getElementById('profileAuthContainer');
  if (user) {
    const favCount = Object.keys(userFavorites).length;
    const dlCount = Object.keys(userDownloads).length;
    const badges = getBadges(dlCount);
    const isPremium = userData?.isPremium === true;
    
    const recentDls = Object.entries(userDownloads).slice(-5).reverse();
    
    container.innerHTML = `
      <div class="profile-cover"></div>
      <div class="profile-avatar-wrap">
        <img src="${user.photoURL || 'https://ui-avatars.com/api/?name=User'}" alt="User">
        ${isPremium ? '<span class="premium-badge-profile"><i class="fas fa-gem"></i> Premium</span>' : '<span class="free-badge-profile">Free</span>'}
        <div class="online-dot"></div>
      </div>
      <h2 style="font-size:1.3rem; font-weight:800; margin-bottom:2px; letter-spacing:-0.3px;">${user.displayName}</h2>
      <p style="color:#64748b; font-size:0.75rem; font-weight:500;">${user.email}</p>
      
      ${isPremium ? 
        '<div class="bio-text" style="color:#f59e0b;">👑 Premium Member · Unlimited Downloads</div>' : 
        '<div class="bio-text">"Collecting the finest wallpapers from around the universe."</div>'
      }

      <div class="badge-container">
        ${badges.length ? badges.map(b => `<span class="badge-item"><i class="fas fa-star"></i> ${b.icon} ${b.label}</span>`).join('') : '<span class="badge-item" style="color:#64748b;"><i class="fas fa-star"></i> Start collecting!</span>'}
      </div>

      <div class="user-meta-grid">
        <div class="meta-box"><span>Favorites</span><strong>${favCount}</strong></div>
        <div class="meta-box"><span>Downloads</span><strong>${dlCount}</strong></div>
        <div class="meta-box"><span>Status</span><strong style="color:#10b981"><i class="fas fa-bolt"></i> Live</strong></div>
      </div>

      <div class="user-id-display">
        <span>🆔 Your User ID</span>
        <span class="uid">${user.uid.substring(0, 12)}...</span>
        <button onclick="navigator.clipboard.writeText('${user.uid}')" style="background:rgba(255,255,255,0.05); border:none; color:#94a3b8; padding:2px 10px; border-radius:6px; cursor:pointer; font-size:0.6rem;">
          <i class="fas fa-copy"></i> Copy
        </button>
      </div>

      ${!isPremium ? `
        <div class="upgrade-box">
          <h3 style="font-size:1.1rem; color:#f59e0b;">👑 Premium Membership</h3>
          <div class="price-big">৳100 <small>/ Yearly</small></div>
          
          <ul class="feature-list">
            <li><i class="fas fa-check-circle"></i> Unlimited 4K Wallpaper Downloads</li>
            <li><i class="fas fa-check-circle"></i> Exclusive Premium Collection</li>
            <li><i class="fas fa-check-circle"></i> Ad-Free Experience</li>
            <li><i class="fas fa-check-circle"></i> Priority Support</li>
          </ul>

          <p style="font-size:0.7rem; color:#94a3b8; margin-bottom:8px;">Select your payment method:</p>
          
          <div class="payment-methods-grid">
            <div class="payment-method-item selected" id="bkashMethod" onclick="selectMethod('bkash')">
              <i class="fas fa-mobile-alt"></i>
              <div class="name">bKash</div>
              <div class="number">01789538134</div>
            </div>
            <div class="payment-method-item" id="nagadMethod" onclick="selectMethod('nagad')">
              <i class="fas fa-mobile-alt"></i>
              <div class="name">Nagad</div>
              <div class="number">01789538134</div>
            </div>
          </div>

          <p style="font-size:0.7rem; color:#94a3b8; text-align:left; margin:4px 0;">
            <i class="fas fa-info-circle"></i> Send exactly <strong>100 Tk</strong> to <strong id="selectedMethodDisplay">BKASH</strong>
          </p>
          
          <input type="text" id="transactionId" class="payment-form-input" placeholder="Transaction ID (e.g., bKashTrx123)" />
          <input type="text" id="senderPhone" class="payment-form-input" placeholder="Your bKash/Nagad Number" />
          <button onclick="submitPayment()" class="btn btn-success" style="width:100%;">
            <i class="fas fa-check-circle"></i> Continue & Verify Payment
          </button>
          <div id="paymentStatus"></div>
        </div>

        <div class="help-center-box">
          <div class="help-title"><i class="fas fa-headset"></i> Help Center</div>
          <div class="help-desc">
            Having issues with payment? 
            <a href="https://t.me/sourov_ray" target="_blank">
              <i class="fab fa-telegram-plane"></i> Live Chat
            </a>
            <br />
            <span style="font-size:0.65rem; color:#64748b;">
              Include your User ID: <strong style="color:#60a5fa; font-family:monospace;">${user.uid.substring(0, 12)}...</strong>
            </span>
          </div>
        </div>
      ` : ''}

      ${recentDls.length ? `
        <div class="profile-actions-title">📥 Recent Downloads</div>
        <div class="download-history">
          ${recentDls.map(([id, item]) => `
            <div class="download-history-item">
              <span class="dl-title">${item.title || 'Untitled'}</span>
              <span class="dl-time">${new Date(item.downloadedAt).toLocaleDateString()}</span>
            </div>
          `).join('')}
        </div>
      ` : ''}

      <div class="profile-actions-title">⚡ Quick Actions</div>
      <div class="profile-actions-list">
        <button class="action-btn-mini" id="pActionTheme"><span><i class="fas fa-adjust"></i> Toggle Theme</span><i class="fas fa-chevron-right" style="font-size:0.7rem; color:#64748b;"></i></button>
        <button class="action-btn-mini" id="pActionClearFavs"><span><i class="fas fa-trash-alt"></i> Clear Favorites</span><i class="fas fa-chevron-right" style="font-size:0.7rem; color:#64748b;"></i></button>
        <button class="action-btn-mini" id="pActionClearDls"><span><i class="fas fa-eraser"></i> Clear History</span><i class="fas fa-chevron-right" style="font-size:0.7rem; color:#64748b;"></i></button>
        <button class="action-btn-mini" onclick="window.open('https://t.me/sourov_ray', '_blank')"><span><i class="fas fa-headset"></i> Help Center</span><i class="fas fa-chevron-right" style="font-size:0.7rem; color:#64748b;"></i></button>
      </div>

      <button class="btn btn-secondary" id="logoutActionBtn" style="color:#ef4444; background:rgba(239,68,68,0.06); width:100%; border:1px solid rgba(239,68,68,0.1); border-radius:18px;">
        <i class="fas fa-sign-out-alt"></i> Logout
      </button>
    `;

    window.selectMethod = selectMethod;
    window.submitPayment = submitPayment;

    document.getElementById('pActionTheme').addEventListener('click', toggleThemeMode);
    document.getElementById('pActionClearFavs').addEventListener('click', function() {
      if (confirm('Remove all favorites?')) {
        set(ref(db, `favorites/${user.uid}`), null).then(() => showToast('🗑️ Favorites cleared!'));
      }
    });
    document.getElementById('pActionClearDls').addEventListener('click', function() {
      if (confirm('Clear download history?')) {
        set(ref(db, `downloads/${user.uid}`), null).then(() => showToast('🗑️ History cleared!'));
      }
    });
    document.getElementById('logoutActionBtn').addEventListener('click', () => {
      signOut(auth).then(() => { profileModal.classList.remove('show'); showToast('👋 Logged out'); });
    });
  } else {
    container.innerHTML = `
      <div style="padding:20px 0">
        <i class="fas fa-user-shield" style="font-size:3.2rem; color:#2563eb; margin-bottom:15px; display:block"></i>
        <h3 style="font-size:1.25rem; font-weight:800; margin-bottom:8px; letter-spacing:-0.3px;">Welcome Back!</h3>
        <p style="color:#94a3b8; font-size:0.85rem; margin-bottom:24px; line-height:1.5;">Sign in to sync your favorites & track downloads.</p>
        <button class="btn btn-primary" id="loginActionBtn" style="width:100%; height:48px; border-radius:18px; font-size:0.9rem;">
          <i class="fab fa-google"></i> Continue with Google
        </button>
      </div>
    `;
    document.getElementById('loginActionBtn').addEventListener('click', () => {
      signInWithPopup(auth, provider).then(() => profileModal.classList.remove('show')).catch(e => showToast('❌ ' + e.message));
    });
  }
}

// ===== THEME =====
function toggleThemeMode() {
  document.body.classList.toggle('light');
  const icon = document.getElementById('themeToggle');
  icon.className = document.body.classList.contains('light') ? 'fas fa-sun' : 'fas fa-moon';
}
document.getElementById('themeToggle').addEventListener('click', toggleThemeMode);

// ===== AUTH STATE =====
onAuthStateChanged(auth, (user) => {
  currentUser = user;
  if (user) {
    onValue(ref(db, `users/${user.uid}`), (snapshot) => {
      currentUserData = snapshot.val() || { isPremium: false };
      renderProfileUI(user, currentUserData);
    });
    
    onValue(ref(db, `favorites/${user.uid}`), (s) => {
      userFavorites = s.val() || {};
      renderFavorites();
    });
    onValue(ref(db, `downloads/${user.uid}`), (s) => {
      userDownloads = s.val() || {};
      renderProfileUI(user, currentUserData);
    });
  } else {
    currentUserData = null;
    userFavorites = {};
    userDownloads = {};
    renderProfileUI(null, null);
    renderFavorites();
  }
});

// ===== TOAST =====
function showToast(m) {
  const t = document.getElementById('toast');
  t.textContent = m;
  t.classList.add('show');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('show'), 3000);
}
window.showToast = showToast;

// ===== LOAD DATA =====
onValue(ref(db, 'wallpapers'), (s) => {
  allData = s.val() || {};
  renderGrids();
});

// ===== KEYBOARD SHORTCUTS =====
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.getElementById('modalOverlay').classList.remove('show');
    document.getElementById('modalVideo').pause();
    searchPopup.classList.remove('show');
    profileModal.classList.remove('show');
  }
  if (e.ctrlKey && e.key === 'k') {
    e.preventDefault();
    searchPopup.classList.toggle('show');
    if (searchPopup.classList.contains('show')) document.getElementById('popupSearchInput').focus();
  }
});