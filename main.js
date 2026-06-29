// ============================================================
// 🔌 FIREBASE CONFIG IMPORT (Using your local config file)
// ============================================================
import { db, auth, provider } from './firebase-config.js';
import { ref, onValue, set, push, update, remove } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js";
import { signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";

// ============================================================
// 🔑 ADMIN UID
// ============================================================
const ADMIN_UID = "kP7A29SA8tb84GhcdLyvNudf30M2"; 

// ============================================================
// ☁️ CLOUDINARY CONFIG
// ============================================================
const CLOUDINARY_CLOUD_NAME = "mzpqfabi";
const CLOUDINARY_UPLOAD_PRESET = "wallpaper_preset";

// ============================================================
// DOM REFS
// ============================================================
const loginPage = document.getElementById('loginPage');
const adminPanel = document.getElementById('adminPanel');
const googleLoginBtn = document.getElementById('googleLoginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const loginError = document.getElementById('loginError');
const loginLoading = document.getElementById('loginLoading');
const userEmail = document.getElementById('userEmail');
const userAvatar = document.getElementById('userAvatar');

let allWallpapers = [];
let selectedIds = new Set();
let editingId = null;
let allPayments = [];

// ============================================================
// AUTH STATE CONTROL
// ============================================================
onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log("Logged in:", user.uid);
    if (user.uid === ADMIN_UID) {
      loginPage.style.display = 'none';
      adminPanel.style.display = 'block';
      userEmail.textContent = user.email;
      userAvatar.src = user.photoURL || 'https://ui-avatars.com/api/?name=Admin';
      loginError.textContent = '';
      loginLoading.style.display = 'none';
      initAdminPanel();
    } else {
      loginError.textContent = '❌ You are not authorized to access this panel.';
      loginLoading.style.display = 'none';
      signOut(auth);
    }
  } else {
    loginPage.style.display = 'block';
    adminPanel.style.display = 'none';
    loginLoading.style.display = 'none';
  }
});

// ===== GOOGLE LOGIN =====
googleLoginBtn.addEventListener('click', async () => {
  loginLoading.style.display = 'block';
  loginError.textContent = '';
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    loginError.textContent = '❌ ' + error.message;
    loginLoading.style.display = 'none';
  }
});

// ===== LOGOUT =====
logoutBtn.addEventListener('click', () => {
  signOut(auth);
  loginPage.style.display = 'block';
  adminPanel.style.display = 'none';
});

// ============================================================
// MAIN ADMIN PANEL FUNCTIONS
// ============================================================
function initAdminPanel() {
  // ===== TABS SYSTEM =====
  document.querySelectorAll('.admin-tabs button').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.admin-tabs button').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      const tab = this.dataset.tab;
      document.getElementById('tabWallpapers').style.display = tab === 'wallpapers' ? 'block' : 'none';
      document.getElementById('tabPayments').style.display = tab === 'payments' ? 'block' : 'none';
      document.getElementById('tabUpload').style.display = tab === 'upload' ? 'block' : 'none';
    });
  });

  // ===== LOAD DATA =====
  loadWallpapers();
  loadPayments();

  // ===== DATA FETCHERS =====
  function loadWallpapers() {
    onValue(ref(db, 'wallpapers'), (snapshot) => {
      const data = snapshot.val() || {};
      allWallpapers = Object.entries(data).map(([id, item]) => ({ id, ...item }));
      renderWallpapers();
      updateStats();
    });
  }

  function loadPayments() {
    onValue(ref(db, 'payments'), (snapshot) => {
      const data = snapshot.val() || {};
      allPayments = Object.entries(data).map(([id, item]) => ({ id, ...item }));
      renderPayments();
      updateStats();
    });
  }

  // ===== RENDER WALLPAPERS =====
  function renderWallpapers() {
    const search = document.getElementById('searchInput').value.toLowerCase().trim();
    let filtered = allWallpapers.filter(item => {
      return (item.title && item.title.toLowerCase().includes(search)) ||
             (item.tag && item.tag.toLowerCase().includes(search));
    });

    const sortSelect = document.getElementById('sortSelect');
    switch(sortSelect.value) {
      case 'oldest': filtered.sort((a,b) => (a.createdAt || 0) - (b.createdAt || 0)); break;
      case 'downloads': filtered.sort((a,b) => (b.downloads || 0) - (a.downloads || 0)); break;
      default: filtered.sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0));
    }

    const grid = document.getElementById('wallpaperGrid');
    if (!filtered.length) {
      grid.innerHTML = '<div class="empty-state"><i class="fas fa-image"></i> No wallpapers found.</div>';
      return;
    }

    grid.innerHTML = filtered.map(item => {
      const checked = selectedIds.has(item.id) ? 'checked' : '';
      const isLive = item.isLive === true || item.imageUrl?.endsWith('.mp4');
      const categoryLabel = item.category === 'trending' ? '🔥 Trending' : '📱 Latest';
      const premiumLabel = item.isPremium ? '👑 Premium' : 'Free';
      const premiumClass = item.isPremium ? 'premium' : 'free';

      return `
        <div class="wallpaper-item" data-id="${item.id}">
          <div class="checkbox-wrap">
            <input type="checkbox" class="item-checkbox" data-id="${item.id}" ${checked} />
          </div>
          <div class="media-wrap" onclick="window.previewAsset('${item.imageUrl}', ${isLive})">
            ${isLive 
              ? `<video src="${item.imageUrl}" muted autoplay loop playsinline></video>`
              : `<img src="${item.imageUrl}" alt="${item.title}" loading="lazy" />`
            }
          </div>
          <div class="info">
            <div class="title">${item.title || 'Untitled'}</div>
            <div class="meta">
              <span class="tag">${item.tag || 'Untagged'}</span>
              <span class="category">${categoryLabel}</span>
              <span class="${premiumClass}">${premiumLabel}</span>
            </div>
          </div>
          <div class="actions">
            <button class="edit-btn" onclick="window.openEdit('${item.id}')"><i class="fas fa-pen"></i> Edit</button>
            <button class="delete-btn" onclick="window.deleteSingle('${item.id}')"><i class="fas fa-trash"></i> Delete</button>
          </div>
        </div>
      `;
    }).join('');

    document.querySelectorAll('.item-checkbox').forEach(cb => {
      cb.addEventListener('change', function() {
        const id = this.dataset.id;
        if (this.checked) selectedIds.add(id);
        else selectedIds.delete(id);
        updateBatchBar();
      });
    });

    updateBatchBar();
  }

  function updateBatchBar() {
    const count = selectedIds.size;
    document.getElementById('selectedCount').textContent = count;
    const bar = document.getElementById('batchDeleteBar');
    if (count > 0) {
      bar.classList.add('show');
    } else {
      bar.classList.remove('show');
    }
  }

  // ===== BATCH DELETE =====
  document.getElementById('batchDeleteBtn').addEventListener('click', function() {
    if (!selectedIds.size) return;
    if (confirm(`Delete ${selectedIds.size} wallpapers permanently?`)) {
      const count = selectedIds.size;
      selectedIds.forEach(id => {
        remove(ref(db, 'wallpapers/' + id));
      });
      selectedIds.clear();
      updateBatchBar();
      showToast(`🗑️ ${count} assets deleted.`);
    }
  });

  document.getElementById('batchCancelBtn').addEventListener('click', function() {
    selectedIds.clear();
    document.querySelectorAll('.item-checkbox').forEach(cb => cb.checked = false);
    updateBatchBar();
  });

  // ===== RENDER PAYMENTS =====
  function renderPayments() {
    const pending = allPayments.filter(p => p.status === 'pending');
    const verified = allPayments.filter(p => p.status === 'verified');

    const pendingContainer = document.getElementById('pendingPayments');
    if (!pending.length) {
      pendingContainer.innerHTML = '<div class="empty-state"><i class="fas fa-check-circle"></i> No pending payments</div>';
    } else {
      pendingContainer.innerHTML = pending.map(p => `
        <div class="payment-item">
          <div class="info">
            <div class="name">${p.userName || 'Unknown'}</div>
            <div class="details">${p.userEmail || 'No email'} · ৳${p.amount} · ${p.package}</div>
            <div class="trx">📝 ${p.transactionId}</div>
            <span class="uid-tag">🆔 ${p.userId?.substring(0, 12)}...</span>
          </div>
          <div>
            <span class="status pending">⏳ Pending</span>
          </div>
          <div class="actions">
            <button class="approve" onclick="window.approvePayment('${p.id}', '${p.userId}')">
              <i class="fas fa-check"></i> Approve
            </button>
            <button class="reject" onclick="window.rejectPayment('${p.id}')">
              <i class="fas fa-times"></i> Reject
            </button>
          </div>
        </div>
      `).join('');
    }

    const verifiedContainer = document.getElementById('verifiedPayments');
    if (!verified.length) {
      verifiedContainer.innerHTML = '<div class="empty-state"><i class="fas fa-history"></i> No verified payments</div>';
    } else {
      verifiedContainer.innerHTML = verified.map(p => `
        <div class="payment-item" style="opacity:0.7;">
          <div class="info">
            <div class="name">${p.userName || 'Unknown'}</div>
            <div class="details">৳${p.amount} · ${p.package}</div>
            <div class="trx">${p.transactionId}</div>
          </div>
          <div>
            <span class="status verified">✅ Verified</span>
          </div>
          <div style="font-size:0.6rem; color:#64748b;">
            ${p.verifiedAt ? new Date(p.verifiedAt).toLocaleDateString() : ''}
          </div>
        </div>
      `).join('');
    }
  }

  // ===== UPDATE STATS =====
  function updateStats() {
    document.getElementById('totalCount').textContent = allWallpapers.length;
    
    const pending = allPayments.filter(p => p.status === 'pending');
    document.getElementById('pendingCount').textContent = pending.length;
    
    const verified = allPayments.filter(p => p.status === 'verified');
    const totalRevenue = verified.reduce((sum, p) => sum + (p.amount || 0), 0);
    document.getElementById('totalRevenue').textContent = '৳' + totalRevenue;

    onValue(ref(db, 'users'), (snapshot) => {
      const users = snapshot.val() || {};
      const premiumUsers = Object.values(users).filter(u => u.isPremium === true);
      document.getElementById('premiumUserCount').textContent = premiumUsers.length;
    });
  }

  // ===== UPLOAD LOGIC =====
  document.getElementById('uploadBtn').addEventListener('click', async function() {
    const fileInput = document.getElementById('fileInput');
    const title = document.getElementById('titleInput').value.trim() || "Premium Asset";
    const category = document.getElementById('categorySelect').value;
    const tag = document.getElementById('tagSelect').value;
    const resolution = document.getElementById('resolutionInput').value.trim() || "4K Ultra HD";
    const isPremium = document.getElementById('premiumSelect').value === "true";
    const statusText = document.getElementById('uploadStatus');

    if (!fileInput.files.length) {
      statusText.innerText = "❌ Select a file!";
      return;
    }

    const file = fileInput.files[0];
    const isLive = file.type.startsWith('video/');

    statusText.innerHTML = "⏳ Uploading...";
    this.disabled = true;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

    try {
      const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await response.json();
      
      if (data.secure_url) {
        const wallpapersRef = ref(db, 'wallpapers');
        const newRef = push(wallpapersRef);
        await set(newRef, {
          title: title,
          imageUrl: data.secure_url,
          category: category,
          tag: tag,
          resolution: resolution,
          isPremium: isPremium,
          isLive: isLive,
          downloads: 0,
          createdAt: Date.now()
        });
        statusText.innerHTML = "✅ Uploaded successfully! 🎉";
        fileInput.value = "";
        document.getElementById('titleInput').value = "";
      } else {
        statusText.innerHTML = "❌ Upload failed!";
      }
    } catch (error) {
      statusText.innerHTML = "❌ Error: " + error.message;
      console.error("Upload Error:", error);
    } finally {
      this.disabled = false;
    }
  });

  // ===== SEARCH & SORT LISTENERS =====
  document.getElementById('searchInput').addEventListener('input', renderWallpapers);
  document.getElementById('sortSelect').addEventListener('change', renderWallpapers);

  // ===== MODAL CANCEL =====
  document.getElementById('editCancelBtn').addEventListener('click', function() {
    document.getElementById('editModal').classList.remove('show');
  });

  // ===== SAVE EDITED DATA =====
  document.getElementById('editSaveBtn').addEventListener('click', async function() {
    if (!editingId) return;
    const updates = {
      title: document.getElementById('editTitle').value.trim() || 'Untitled',
      category: document.getElementById('editCategory').value,
      tag: document.getElementById('editTag').value,
      resolution: document.getElementById('editResolution').value.trim() || '4K Ultra HD',
      isPremium: document.getElementById('editPremium').value === 'true',
      isLive: document.getElementById('editIsLive').value === 'true'
    };
    try {
      await update(ref(db, 'wallpapers/' + editingId), updates);
      document.getElementById('editModal').classList.remove('show');
      showToast('✅ Updated successfully!');
    } catch (err) {
      showToast('❌ Error: ' + err.message);
    }
  });
}

// ============================================================
// GLOBAL FUNCTIONS (Exposed to window for HTML inline clicks)
// ============================================================
window.previewAsset = function(url, isVideo) {
  const container = document.getElementById('previewContainer');
  if (isVideo) {
    container.innerHTML = `<video src="${url}" autoplay loop controls style="max-width:90%; max-height:90%; border-radius:16px;"></video>`;
  } else {
    container.innerHTML = `<img src="${url}" alt="Preview" style="max-width:90%; max-height:90%; border-radius:16px; object-fit:contain;" />`;
  }
  document.getElementById('previewModal').classList.add('show');
};

window.openEdit = function(id) {
  // We look into the global allWallpapers state
  const item = allWallpapers.find(w => w.id === id);
  if (!item) return;
  editingId = id;
  document.getElementById('editTitle').value = item.title || '';
  document.getElementById('editCategory').value = item.category || 'latest';
  document.getElementById('editTag').value = item.tag || 'Nature';
  document.getElementById('editResolution').value = item.resolution || '4K Ultra HD';
  document.getElementById('editPremium').value = item.isPremium ? 'true' : 'false';
  document.getElementById('editIsLive').value = (item.isLive === true || item.imageUrl?.endsWith('.mp4')) ? 'true' : 'false';
  document.getElementById('editModal').classList.add('show');
};

window.deleteSingle = function(id) {
  if (confirm('Delete this wallpaper permanently?')) {
    remove(ref(db, 'wallpapers/' + id));
    if (selectedIds.has(id)) selectedIds.delete(id);
    showToast('🗑️ Asset deleted.');
  }
};

window.approvePayment = async function(paymentId, userId) {
  if (!confirm('Approve this payment?')) return;
  try {
    await update(ref(db, `payments/${paymentId}`), {
      status: 'verified',
      verifiedAt: Date.now()
    });
    await update(ref(db, `users/${userId}`), {
      isPremium: true,
      premiumSince: Date.now()
    });
    showToast('✅ Payment approved! User is now Premium.');
  } catch (error) {
    showToast('❌ Error: ' + error.message);
  }
};

window.rejectPayment = async function(paymentId) {
  if (!confirm('Reject this payment?')) return;
  try {
    await update(ref(db, `payments/${paymentId}`), {
      status: 'failed'
    });
    showToast('❌ Payment rejected.');
  } catch (error) {
    showToast('❌ Error: ' + error.message);
  }
};

// ===== TOAST GLOBAL FUNCTION =====
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('show'), 3000);
}

// ===== GLOBAL KEYBOARD SHORTCUTS =====
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.getElementById('editModal').classList.remove('show');
    document.getElementById('previewModal').classList.remove('show');
    const container = document.getElementById('previewContainer');
    if(container) {
      const video = container.querySelector('video');
      if (video) video.pause();
    }
  }
});
