// ==================== ZAMN - Instagram Clone ====================
let currentUser = null;
let currentPostId = null;
let currentChatUser = null;
let currentProfileUser = null;
let selectedPostMedia = null;
let selectedMediaType = null;
let currentView = 'home';
let currentReelIndex = 0;
let reelsList = [];

// ==================== Infinite Scroll ====================
let allPostsCache = [];
let currentDisplayCount = 0;
let isLoadingMore = false;
let hasMorePosts = true;
let scrollListenerActive = true;
const POSTS_PER_BATCH = 5;

// ==================== Bad Words ====================
let badWordsList = [];

// ==================== Helper Functions ====================
function showToast(message, duration = 2000) {
    const toast = document.getElementById('customToast');
    if (!toast) return;
    toast.textContent = message;
    toast.style.opacity = '1';
    setTimeout(() => {
        toast.style.opacity = '0';
    }, duration);
}

function formatTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days} يوم`;
    if (hours > 0) return `${hours} ساعة`;
    if (minutes > 0) return `${minutes} دقيقة`;
    return `${seconds} ثانية`;
}

function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ==================== Theme ====================
function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    const themeIcon = document.getElementById('themeIcon');
    if (themeIcon) {
        if (isDark) {
            themeIcon.classList.remove('fa-sun');
            themeIcon.classList.add('fa-moon');
        } else {
            themeIcon.classList.remove('fa-moon');
            themeIcon.classList.add('fa-sun');
        }
    }
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

function loadTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        const themeIcon = document.getElementById('themeIcon');
        if (themeIcon) {
            themeIcon.classList.remove('fa-sun');
            themeIcon.classList.add('fa-moon');
        }
    }
}

// ==================== Upload to Cloudinary ====================
async function uploadToCloudinary(file) {
    const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', UPLOAD_PRESET);
    
    try {
        const response = await fetch(url, { method: 'POST', body: formData });
        const data = await response.json();
        if (data.secure_url) return data.secure_url;
        throw new Error('Upload failed');
    } catch (error) {
        console.error('Cloudinary error:', error);
        showToast('فشل رفع الملف');
        return null;
    }
}

// ==================== Upload Avatar ====================
async function uploadAvatar(input) {
    const file = input.files[0];
    if (!file) return;
    
    showToast('🔄 جاري رفع الصورة...');
    const url = await uploadToCloudinary(file);
    if (url) {
        await db.ref(`users/${currentUser.uid}`).update({ avatar: url });
        currentUser.avatar = url;
        showToast('✅ تم تغيير الصورة الشخصية');
        if (currentProfileUser === currentUser.uid) openProfile(currentUser.uid);
    }
}

// ==================== Create Post ====================
function previewPostMedia(input) {
    const file = input.files[0];
    if (!file) return;
    
    selectedPostMedia = file;
    selectedMediaType = file.type.split('/')[0];
    
    const previewArea = document.getElementById('postPreviewArea');
    const previewImg = document.getElementById('postPreview');
    const previewVideo = document.getElementById('postVideoPreview');
    
    const reader = new FileReader();
    reader.onload = function(e) {
        if (selectedMediaType === 'image') {
            previewImg.style.display = 'block';
            previewVideo.style.display = 'none';
            previewImg.src = e.target.result;
        } else {
            previewImg.style.display = 'none';
            previewVideo.style.display = 'block';
            previewVideo.src = e.target.result;
        }
        previewArea.style.display = 'block';
    };
    reader.readAsDataURL(file);
}

async function createPost() {
    if (!selectedPostMedia) {
        showToast('⚠️ الرجاء اختيار صورة أو فيديو');
        return;
    }
    
    const caption = document.getElementById('postCaption').value;
    const mediaUrl = await uploadToCloudinary(selectedPostMedia);
    if (!mediaUrl) return;
    
    const hashtags = caption.match(/#[\w\u0600-\u06FF]+/g) || [];
    const postRef = db.ref('posts').push();
    
    await postRef.set({
        id: postRef.key,
        userId: currentUser.uid,
        userName: currentUser.name,
        userAvatar: currentUser.avatar || "",
        username: currentUser.username,
        caption: caption,
        mediaUrl: mediaUrl,
        mediaType: selectedMediaType,
        hashtags: hashtags.map(t => t.substring(1)),
        likes: {},
        comments: {},
        commentsCount: 0,
        timestamp: Date.now()
    });
    
    document.getElementById('postCaption').value = '';
    selectedPostMedia = null;
    document.getElementById('postPreviewArea').style.display = 'none';
    closeCreatePost();
    await refreshFeedCache();
    showToast('✅ تم نشر المنشور');
}

// ==================== Like Post ====================
async function likePost(postId) {
    const likeRef = db.ref(`posts/${postId}/likes/${currentUser.uid}`);
    const snapshot = await likeRef.once('value');
    const wasLiked = snapshot.exists();
    
    if (wasLiked) {
        await likeRef.remove();
    } else {
        await likeRef.set(true);
        // Add heart animation
        const likeBtn = document.querySelector(`.post-card[data-post-id="${postId}"] .post-action:first-child`);
        if (likeBtn) {
            likeBtn.classList.add('liked');
            setTimeout(() => likeBtn.classList.remove('liked'), 300);
        }
    }
    refreshFeedCache();
}

// ==================== Comments ====================
async function openComments(postId) {
    currentPostId = postId;
    const snapshot = await db.ref(`posts/${postId}/comments`).once('value');
    const comments = snapshot.val();
    const container = document.getElementById('commentsList');
    
    if (!comments) {
        container.innerHTML = '<div style="text-align: center; padding: 20px; color: #8e8e8e;">لا توجد تعليقات بعد</div>';
    } else {
        let html = '';
        const commentsArray = Object.values(comments).sort((a, b) => b.timestamp - a.timestamp);
        for (const comment of commentsArray) {
            html += `
                <div style="display: flex; gap: 12px; padding: 12px 0; border-bottom: 1px solid #EFEFEF;">
                    <div class="post-avatar" style="width: 32px; height: 32px;">
                        ${comment.userAvatar ? `<img src="${comment.userAvatar}">` : '<i class="fa-solid fa-user"></i>'}
                    </div>
                    <div style="flex: 1;">
                        <div style="font-weight: 600; font-size: 13px;">${escapeHtml(comment.userName)}</div>
                        <div style="font-size: 13px;">${escapeHtml(comment.text)}</div>
                        <div style="font-size: 10px; color: #8e8e8e;">${formatTime(comment.timestamp)}</div>
                    </div>
                </div>
            `;
        }
        container.innerHTML = html;
    }
    document.getElementById('commentsModal').classList.add('open');
}

function closeCommentsModal() {
    document.getElementById('commentsModal').classList.remove('open');
    currentPostId = null;
}

async function addComment() {
    const text = document.getElementById('commentText').value;
    if (!text || !currentPostId) return;
    
    await db.ref(`posts/${currentPostId}/comments`).push({
        userId: currentUser.uid,
        userName: currentUser.name,
        userAvatar: currentUser.avatar || "",
        text: text,
        timestamp: Date.now()
    });
    
    const postRef = db.ref(`posts/${currentPostId}`);
    const snapshot = await postRef.once('value');
    const post = snapshot.val();
    await postRef.update({ commentsCount: (post.commentsCount || 0) + 1 });
    
    document.getElementById('commentText').value = '';
    await openComments(currentPostId);
    refreshFeedCache();
    showToast('💬 تم إضافة التعليق');
}

// ==================== Stories ====================
async function loadStories() {
    const snapshot = await db.ref('stories').once('value');
    const stories = snapshot.val();
    const container = document.getElementById('storiesList');
    if (!container) return;
    
    let html = '';
    if (currentUser) {
        html += `
            <div class="story-item" onclick="addStory()">
                <div class="story-ring">
                    <div class="story-avatar">
                        ${currentUser.avatar ? `<img src="${currentUser.avatar}">` : '<i class="fa-solid fa-user"></i>'}
                    </div>
                </div>
                <div class="story-name">قصتك</div>
            </div>
        `;
    }
    
    if (stories) {
        for (const [id, story] of Object.entries(stories)) {
            if (Date.now() - story.timestamp < 86400000) {
                const userSnapshot = await db.ref(`users/${story.userId}`).once('value');
                const user = userSnapshot.val();
                if (user) {
                    html += `
                        <div class="story-item" onclick="viewStory('${id}')">
                            <div class="story-ring">
                                <div class="story-avatar">
                                    ${story.mediaType === 'image' ? `<img src="${story.mediaUrl}">` : `<video src="${story.mediaUrl}" style="width:100%;height:100%;object-fit:cover;"></video>`}
                                </div>
                            </div>
                            <div class="story-name">${escapeHtml(user.name)}</div>
                        </div>
                    `;
                }
            }
        }
    }
    container.innerHTML = html;
}

async function addStory() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,video/*';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            const url = await uploadToCloudinary(file);
            if (url) {
                await db.ref('stories').push({
                    userId: currentUser.uid,
                    mediaUrl: url,
                    mediaType: file.type.split('/')[0],
                    timestamp: Date.now()
                });
                showToast('📸 تم إضافة القصة');
                loadStories();
            }
        }
    };
    input.click();
}

function viewStory(storyId) {
    showToast('📖 مشاهدة القصة - قريباً');
}

// ==================== Reels ====================
async function loadReels() {
    const snapshot = await db.ref('posts').once('value');
    const posts = snapshot.val();
    if (!posts) return;
    
    reelsList = Object.values(posts).filter(p => p.mediaType === 'video').sort((a, b) => b.timestamp - a.timestamp);
    const container = document.getElementById('reelsContainer');
    if (!container) return;
    
    if (reelsList.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 40px; color: #8e8e8e;">لا توجد ريلز بعد</div>';
        return;
    }
    
    let html = '';
    for (const reel of reelsList) {
        const isLiked = reel.likes && reel.likes[currentUser?.uid];
        const likesCount = reel.likes ? Object.keys(reel.likes).length : 0;
        html += `
            <div class="post-card" style="margin-bottom: 16px;">
                <div class="post-header">
                    <div class="post-user" onclick="openProfile('${reel.userId}')">
                        <div class="post-avatar">
                            ${reel.userAvatar ? `<img src="${reel.userAvatar}">` : '<i class="fa-solid fa-user"></i>'}
                        </div>
                        <div>
                            <div class="post-username">${escapeHtml(reel.userName)}</div>
                            <div class="post-location">${reel.hashtags ? reel.hashtags[0] ? '#' + reel.hashtags[0] : '' : ''}</div>
                        </div>
                    </div>
                    <div class="post-menu"><i class="fa-solid fa-ellipsis-vertical"></i></div>
                </div>
                <video src="${reel.mediaUrl}" class="post-video" controls loop playsinline></video>
                <div class="post-actions">
                    <div class="post-actions-left">
                        <button class="post-action ${isLiked ? 'liked' : ''}" onclick="likePost('${reel.id}')"><i class="fa-regular fa-heart"></i></button>
                        <button class="post-action" onclick="openComments('${reel.id}')"><i class="fa-regular fa-comment"></i></button>
                        <button class="post-action"><i class="fa-regular fa-paper-plane"></i></button>
                    </div>
                    <button class="post-action"><i class="fa-regular fa-bookmark"></i></button>
                </div>
                <div class="post-likes">${formatNumber(likesCount)} إعجاب</div>
                <div class="post-caption"><span>${escapeHtml(reel.userName)}</span> ${escapeHtml(reel.caption || '')}</div>
                <div class="post-comments" onclick="openComments('${reel.id}')">عرض جميع التعليقات (${reel.commentsCount || 0})</div>
            </div>
        `;
    }
    container.innerHTML = html;
}

// ==================== Explore ====================
async function loadExplore() {
    const snapshot = await db.ref('posts').once('value');
    const posts = snapshot.val();
    const container = document.getElementById('exploreGrid');
    if (!container) return;
    
    if (!posts) {
        container.innerHTML = '<div style="text-align: center; padding: 40px; color: #8e8e8e;">لا توجد منشورات</div>';
        return;
    }
    
    let html = '';
    const postsArray = Object.values(posts).sort((a, b) => b.timestamp - a.timestamp);
    for (const post of postsArray.slice(0, 30)) {
        html += `
            <div class="grid-item" onclick="viewPost('${post.id}')">
                ${post.mediaType === 'image' ? 
                    `<img src="${post.mediaUrl}" loading="lazy">` : 
                    `<video src="${post.mediaUrl}" style="width:100%;height:100%;object-fit:cover;"></video>`
                }
            </div>
        `;
    }
    container.innerHTML = html;
}

function viewPost(postId) {
    showToast('📱 عرض المنشور - قريباً');
}

// ==================== Profile ====================
async function openMyProfile() {
    if (currentUser) openProfile(currentUser.uid);
}

async function openProfile(userId) {
    currentProfileUser = userId;
    const snapshot = await db.ref(`users/${userId}`).once('value');
    const user = snapshot.val();
    if (!user) return;
    
    const postsSnapshot = await db.ref('posts').once('value');
    const posts = postsSnapshot.val();
    const userPosts = posts ? Object.values(posts).filter(p => p.userId === userId).length : 0;
    
    const followersSnapshot = await db.ref(`followers/${userId}`).once('value');
    const followingSnapshot = await db.ref(`following/${userId}`).once('value');
    const followersCount = followersSnapshot.exists() ? Object.keys(followersSnapshot.val()).length : 0;
    const followingCount = followingSnapshot.exists() ? Object.keys(followingSnapshot.val()).length : 0;
    
    const isFollowing = await checkIfFollowing(userId);
    const isOwner = userId === currentUser.uid;
    
    const profileHtml = `
        <div class="profile-header">
            <div class="profile-avatar-large" onclick="${isOwner ? "document.getElementById('avatarInput').click()" : ""}" style="cursor: ${isOwner ? 'pointer' : 'default'}">
                ${user.avatar ? `<img src="${user.avatar}">` : '<i class="fa-solid fa-user fa-3x" style="margin: 25px;"></i>'}
            </div>
            <div class="profile-info">
                <div class="profile-name">${escapeHtml(user.name)}</div>
                <div class="profile-stats">
                    <div class="profile-stat" onclick="openUserPosts('${userId}')">
                        <div class="profile-stat-number">${userPosts}</div>
                        <div class="profile-stat-label">منشورات</div>
                    </div>
                    <div class="profile-stat" onclick="openFollowersList('followers', '${userId}')">
                        <div class="profile-stat-number">${followersCount}</div>
                        <div class="profile-stat-label">متابعون</div>
                    </div>
                    <div class="profile-stat" onclick="openFollowersList('following', '${userId}')">
                        <div class="profile-stat-number">${followingCount}</div>
                        <div class="profile-stat-label">متابَعون</div>
                    </div>
                </div>
                <div class="profile-bio">${escapeHtml(user.bio || '')}</div>
                ${user.website ? `<a href="${user.website}" target="_blank" class="profile-link">${user.website}</a>` : ''}
                <div class="profile-buttons">
                    ${!isOwner ? `<button class="profile-btn ${isFollowing ? '' : 'profile-btn-primary'}" onclick="toggleFollow('${userId}')">${isFollowing ? 'متابَع' : 'متابعة'}</button>` : ''}
                    ${!isOwner ? `<button class="profile-btn" onclick="openChat('${userId}')">رسالة</button>` : ''}
                    ${isOwner ? `<button class="profile-btn" onclick="openEditProfile()">تعديل الملف</button>` : ''}
                    ${currentUser.isAdmin && !isOwner ? `<button class="profile-btn" onclick="deleteUser('${userId}')" style="color: #ed4956;">حذف</button>` : ''}
                </div>
            </div>
        </div>
        <div class="profile-tabs">
            <button class="profile-tab active" onclick="loadUserPosts('${userId}')"><i class="fa-solid fa-table-cells-large"></i></button>
            <button class="profile-tab" onclick="loadUserReels('${userId}')"><i class="fa-solid fa-clapperboard"></i></button>
            <button class="profile-tab" onclick="loadUserTags('${userId}')"><i class="fa-regular fa-bookmark"></i></button>
        </div>
        <div id="userPostsGrid" class="profile-grid"></div>
    `;
    
    document.getElementById('profileContent').innerHTML = profileHtml;
    document.getElementById('profileModal').classList.add('open');
    await loadUserPosts(userId);
}

function closeProfile() {
    document.getElementById('profileModal').classList.remove('open');
}

async function loadUserPosts(userId) {
    const postsSnapshot = await db.ref('posts').once('value');
    const posts = postsSnapshot.val();
    if (!posts) {
        document.getElementById('userPostsGrid').innerHTML = '<div style="text-align: center; padding: 40px;">لا توجد منشورات</div>';
        return;
    }
    
    const userPosts = Object.values(posts).filter(p => p.userId === userId).sort((a, b) => b.timestamp - a.timestamp);
    let html = '';
    for (const post of userPosts.slice(0, 12)) {
        html += `
            <div class="grid-item" onclick="viewPost('${post.id}')">
                ${post.mediaType === 'image' ? 
                    `<img src="${post.mediaUrl}" loading="lazy">` : 
                    `<video src="${post.mediaUrl}" style="width:100%;height:100%;object-fit:cover;"></video>`
                }
            </div>
        `;
    }
    document.getElementById('userPostsGrid').innerHTML = html || '<div style="text-align: center; padding: 40px;">لا توجد منشورات</div>';
}

async function loadUserReels(userId) {
    const postsSnapshot = await db.ref('posts').once('value');
    const posts = postsSnapshot.val();
    if (!posts) {
        document.getElementById('userPostsGrid').innerHTML = '<div style="text-align: center; padding: 40px;">لا توجد ريلز</div>';
        return;
    }
    
    const userReels = Object.values(posts).filter(p => p.userId === userId && p.mediaType === 'video').sort((a, b) => b.timestamp - a.timestamp);
    let html = '';
    for (const reel of userReels.slice(0, 12)) {
        html += `
            <div class="grid-item" onclick="viewPost('${reel.id}')">
                <video src="${reel.mediaUrl}" style="width:100%;height:100%;object-fit:cover;"></video>
            </div>
        `;
    }
    document.getElementById('userPostsGrid').innerHTML = html || '<div style="text-align: center; padding: 40px;">لا توجد ريلز</div>';
}

function loadUserTags(userId) {
    document.getElementById('userPostsGrid').innerHTML = '<div style="text-align: center; padding: 40px;">لا توجد علامات</div>';
}

function openUserPosts(userId) {
    loadUserPosts(userId);
}

function openEditProfile() {
    document.getElementById('editName').value = currentUser.name || '';
    document.getElementById('editUsername').value = currentUser.username || '';
    document.getElementById('editBio').value = currentUser.bio || '';
    document.getElementById('editWebsite').value = currentUser.website || '';
    document.getElementById('editProfileModal').classList.add('open');
}

function closeEditProfile() {
    document.getElementById('editProfileModal').classList.remove('open');
}

async function saveProfileEdit() {
    const newName = document.getElementById('editName').value;
    const newUsername = document.getElementById('editUsername').value;
    const newBio = document.getElementById('editBio').value;
    const newWebsite = document.getElementById('editWebsite').value;
    
    const updates = {};
    if (newName) updates.name = newName;
    if (newUsername) updates.username = newUsername;
    if (newBio !== undefined) updates.bio = newBio;
    if (newWebsite !== undefined) updates.website = newWebsite;
    
    await db.ref(`users/${currentUser.uid}`).update(updates);
    currentUser = { ...currentUser, ...updates };
    closeEditProfile();
    openProfile(currentUser.uid);
    showToast('✅ تم حفظ التغييرات');
}

// ==================== Follow System ====================
async function checkIfFollowing(userId) {
    const snapshot = await db.ref(`followers/${userId}/${currentUser.uid}`).once('value');
    return snapshot.exists();
}

async function toggleFollow(userId) {
    const isFollowing = await checkIfFollowing(userId);
    if (isFollowing) {
        await db.ref(`followers/${userId}/${currentUser.uid}`).remove();
        await db.ref(`following/${currentUser.uid}/${userId}`).remove();
        showToast('❌ تم إلغاء المتابعة');
    } else {
        await db.ref(`followers/${userId}/${currentUser.uid}`).set(true);
        await db.ref(`following/${currentUser.uid}/${userId}`).set(true);
        showToast('✅ تم المتابعة');
    }
    openProfile(userId);
}

// ==================== Followers List ====================
async function openFollowersList(type, userId) {
    const targetUserId = userId || currentProfileUser;
    const refPath = type === 'followers' ? `followers/${targetUserId}` : `following/${targetUserId}`;
    const snapshot = await db.ref(refPath).once('value');
    const data = snapshot.val();
    if (!data) {
        showToast(`لا يوجد ${type === 'followers' ? 'متابعون' : 'متابَعون'}`);
        return;
    }
    
    let html = `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <h3 style="font-weight: 600;">${type === 'followers' ? 'المتابعون' : 'المتابَعون'}</h3>
                    <button onclick="this.closest('.modal-overlay').remove()" style="background: none; border: none; font-size: 24px;">&times;</button>
                </div>`;
    
    for (const uid of Object.keys(data)) {
        const userSnapshot = await db.ref(`users/${uid}`).once('value');
        const user = userSnapshot.val();
        if (user) {
            html += `
                <div class="follower-item" onclick="openProfile('${uid}'); this.closest('.modal-overlay').remove();" style="display: flex; align-items: center; gap: 12px; padding: 12px; cursor: pointer; border-bottom: 1px solid #EFEFEF;">
                    <div class="post-avatar" style="width: 40px; height: 40px;">
                        ${user.avatar ? `<img src="${user.avatar}">` : '<i class="fa-solid fa-user"></i>'}
                    </div>
                    <div>
                        <div style="font-weight: 600;">${escapeHtml(user.name)}</div>
                        <div style="color: #8e8e8e; font-size: 12px;">@${escapeHtml(user.username || user.name)}</div>
                    </div>
                </div>
            `;
        }
    }
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay open';
    modal.innerHTML = `<div class="modal-content" style="max-width: 400px;">${html}</div>`;
    document.body.appendChild(modal);
}

// ==================== Direct Messages ====================
async function openConversations() {
    const snapshot = await db.ref('chats').once('value');
    const chats = snapshot.val();
    const container = document.getElementById('conversationsList');
    
    if (!chats) {
        container.innerHTML = '<div style="text-align: center; padding: 40px; color: #8e8e8e;">لا توجد محادثات</div>';
    } else {
        const conversations = [];
        for (const [chatId, messages] of Object.entries(chats)) {
            const [user1, user2] = chatId.split('_');
            const otherUserId = user1 === currentUser.uid ? user2 : user1;
            const userSnapshot = await db.ref(`users/${otherUserId}`).once('value');
            const userData = userSnapshot.val();
            const messagesArray = Object.values(messages);
            const lastMessage = messagesArray.sort((a, b) => b.timestamp - a.timestamp)[0];
            conversations.push({ userId: otherUserId, userData, lastMessage, timestamp: lastMessage.timestamp });
        }
        conversations.sort((a, b) => b.timestamp - a.timestamp);
        
        let html = '';
        for (const conv of conversations) {
            html += `
                <div class="follower-item" onclick="openChat('${conv.userId}')" style="display: flex; align-items: center; gap: 12px; padding: 12px; cursor: pointer; border-bottom: 1px solid #EFEFEF;">
                    <div class="post-avatar" style="width: 44px; height: 44px;">
                        ${conv.userData?.avatar ? `<img src="${conv.userData.avatar}">` : '<i class="fa-solid fa-user"></i>'}
                    </div>
                    <div style="flex: 1;">
                        <div style="font-weight: 600;">${escapeHtml(conv.userData?.name || 'مستخدم')}</div>
                        <div style="font-size: 12px; color: #8e8e8e;">${conv.lastMessage.text ? conv.lastMessage.text.substring(0, 30) : (conv.lastMessage.imageUrl ? 'صورة' : '')}</div>
                    </div>
                </div>
            `;
        }
        container.innerHTML = html;
    }
    document.getElementById('conversationsModal').classList.add('open');
}

function closeConversations() {
    document.getElementById('conversationsModal').classList.remove('open');
}

async function openChat(userId) {
    const snapshot = await db.ref(`users/${userId}`).once('value');
    currentChatUser = snapshot.val();
    document.getElementById('chatUserName').innerHTML = escapeHtml(currentChatUser.name);
    await loadChatMessages(userId);
    document.getElementById('chatModal').classList.add('open');
    closeConversations();
}

function closeChat() {
    document.getElementById('chatModal').classList.remove('open');
    if (currentChatUser) {
        const chatId = getChatId(currentUser.uid, currentChatUser.uid);
        db.ref(`chats/${chatId}`).off();
    }
    currentChatUser = null;
}

function getChatId(user1, user2) {
    return [user1, user2].sort().join('_');
}

async function loadChatMessages(userId) {
    const chatId = getChatId(currentUser.uid, userId);
    db.ref(`chats/${chatId}`).off();
    db.ref(`chats/${chatId}`).on('value', (snapshot) => {
        const messages = snapshot.val();
        const container = document.getElementById('chatMessages');
        if (!container) return;
        if (!messages) {
            container.innerHTML = '<div style="text-align: center; padding: 40px; color: #8e8e8e;">لا توجد رسائل بعد</div>';
            return;
        }
        let html = '';
        const messagesArray = Object.values(messages).sort((a, b) => a.timestamp - b.timestamp);
        for (const msg of messagesArray) {
            const isSent = msg.senderId === currentUser.uid;
            html += `
                <div class="dm-message ${isSent ? 'sent' : 'received'}">
                    ${msg.text ? escapeHtml(msg.text) : ''}
                    ${msg.imageUrl ? `<img src="${msg.imageUrl}" style="max-width: 200px; border-radius: 12px; margin-top: 8px;">` : ''}
                </div>
            `;
        }
        container.innerHTML = html;
        container.scrollTop = container.scrollHeight;
    });
}

async function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const text = input?.value;
    if (!text || !currentChatUser) return;
    const chatId = getChatId(currentUser.uid, currentChatUser.uid);
    await db.ref(`chats/${chatId}`).push({ senderId: currentUser.uid, text: text, timestamp: Date.now() });
    input.value = '';
}

async function sendChatImage(input) {
    const file = input.files[0];
    if (file && currentChatUser) {
        const url = await uploadToCloudinary(file);
        if (url) {
            const chatId = getChatId(currentUser.uid, currentChatUser.uid);
            await db.ref(`chats/${chatId}`).push({ senderId: currentUser.uid, imageUrl: url, timestamp: Date.now() });
            showToast('✅ تم إرسال الصورة');
        }
    }
    input.value = '';
}

// ==================== Notifications ====================
function openNotifications() {
    showToast('🔔 الإشعارات - قريباً');
}

// ==================== Bad Words Management ====================
async function loadBadWordsList() {
    const snapshot = await db.ref('badWords').once('value');
    const words = snapshot.val();
    if (words) {
        badWordsList = Object.values(words);
    } else {
        badWordsList = [];
    }
}

async function addBadWord(word) {
    if (!word.trim()) return;
    await db.ref('badWords').push().set(word.trim().toLowerCase());
    await loadBadWordsList();
    showToast(`✅ تمت إضافة كلمة: ${word}`);
    if (currentUser?.isAdmin) openAdminPanel();
}

async function removeBadWord(wordId, word) {
    await db.ref(`badWords/${wordId}`).remove();
    await loadBadWordsList();
    showToast(`🗑️ تم حذف كلمة: ${word}`);
    if (currentUser?.isAdmin) openAdminPanel();
}

function showAddBadWordModal() {
    const word = prompt('📝 أدخل الكلمة التي تريد منعها:');
    if (word && word.trim()) addBadWord(word.trim());
}

// ==================== Admin Panel ====================
async function openAdminPanel() {
    if (!currentUser.isAdmin) {
        showToast('🚫 غير مصرح لك');
        return;
    }
    
    const usersSnapshot = await db.ref('users').once('value');
    const postsSnapshot = await db.ref('posts').once('value');
    const storiesSnapshot = await db.ref('stories').once('value');
    
    document.getElementById('adminUsersCount').textContent = usersSnapshot.exists() ? Object.keys(usersSnapshot.val()).length : 0;
    document.getElementById('adminPostsCount').textContent = postsSnapshot.exists() ? Object.keys(postsSnapshot.val()).length : 0;
    document.getElementById('adminStoriesCount').textContent = storiesSnapshot.exists() ? Object.keys(storiesSnapshot.val()).length : 0;
    
    const badWordsSnapshot = await db.ref('badWords').once('value');
    const badWords = badWordsSnapshot.val();
    const badWordsContainer = document.getElementById('adminBadWordsList');
    if (badWordsContainer) {
        if (!badWords) {
            badWordsContainer.innerHTML = '<div style="padding: 12px; color: #8e8e8e;">📝 لا توجد كلمات ممنوعة</div>';
        } else {
            let html = '';
            for (const [id, word] of Object.entries(badWords)) {
                html += `
                    <div class="admin-item">
                        <div><span style="font-weight: 600;">🚫 ${escapeHtml(word)}</span></div>
                        <button class="profile-btn" onclick="removeBadWord('${id}', '${word}')" style="background: #ed4956; color: white; padding: 4px 12px;">حذف</button>
                    </div>
                `;
            }
            badWordsContainer.innerHTML = html;
        }
    }
    
    let usersHtml = '';
    if (usersSnapshot.exists()) {
        for (const [uid, user] of Object.entries(usersSnapshot.val())) {
            if (uid !== currentUser.uid) {
                usersHtml += `
                    <div class="admin-item">
                        <div>
                            <div style="font-weight: 600;">${escapeHtml(user.name)}</div>
                            <div style="font-size: 12px; color: #8e8e8e;">${escapeHtml(user.email)}</div>
                        </div>
                        <button class="profile-btn" onclick="deleteUser('${uid}')" style="background: #ed4956; color: white; padding: 4px 12px;">حذف</button>
                    </div>
                `;
            }
        }
    }
    document.getElementById('adminUsersList').innerHTML = usersHtml || '<div style="padding: 12px; color: #8e8e8e;">لا يوجد مستخدمين</div>';
    
    document.getElementById('adminPanel').classList.add('open');
}

function closeAdmin() {
    document.getElementById('adminPanel').classList.remove('open');
}

async function deleteUser(userId) {
    if (confirm('⚠️ هل أنت متأكد من حذف هذا المستخدم نهائياً؟')) {
        await db.ref(`users/${userId}`).remove();
        showToast('🗑️ تم حذف المستخدم');
        openAdminPanel();
    }
}

// ==================== View Switching ====================
function switchView(view) {
    currentView = view;
    document.getElementById('homeView').style.display = view === 'home' ? 'block' : 'none';
    document.getElementById('exploreView').style.display = view === 'explore' ? 'block' : 'none';
    document.getElementById('reelsView').style.display = view === 'reels' ? 'block' : 'none';
    
    const navItems = document.querySelectorAll('.bottom-nav .nav-item');
    navItems.forEach((item, index) => {
        if ((view === 'home' && index === 0) ||
            (view === 'explore' && index === 1) ||
            (view === 'reels' && index === 3)) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
    
    if (view === 'explore') loadExplore();
    if (view === 'reels') loadReels();
}

// ==================== Create Post Modal ====================
function openCreatePost() {
    document.getElementById('createPostModal').classList.add('open');
}

function closeCreatePost() {
    document.getElementById('createPostModal').classList.remove('open');
    document.getElementById('postCaption').value = '';
    selectedPostMedia = null;
    document.getElementById('postPreviewArea').style.display = 'none';
}

// ==================== Infinite Scroll ====================
async function loadAllPostsToCache() {
    const feedContainer = document.getElementById('feedContainer');
    if (!feedContainer) return;
    
    const snapshot = await db.ref('posts').once('value');
    const posts = snapshot.val();
    
    if (!posts || Object.keys(posts).length === 0) {
        feedContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #8e8e8e;">✨ لا توجد منشورات بعد - كن أول من ينشر! ✨</div>';
        hasMorePosts = false;
        return;
    }
    
    let postsArray = Object.values(posts).sort((a, b) => b.timestamp - a.timestamp);
    allPostsCache = postsArray;
    hasMorePosts = allPostsCache.length > POSTS_PER_BATCH;
    currentDisplayCount = POSTS_PER_BATCH;
    
    feedContainer.innerHTML = '';
    await displayPosts(0, POSTS_PER_BATCH);
    
    if (scrollListenerActive) setupSmoothScrollListener();
}

async function displayPosts(startIndex, count) {
    const feedContainer = document.getElementById('feedContainer');
    if (!feedContainer) return;
    
    const endIndex = Math.min(startIndex + count, allPostsCache.length);
    const postsToShow = allPostsCache.slice(startIndex, endIndex);
    
    for (const post of postsToShow) {
        const postHtml = await createPostCard(post);
        feedContainer.insertAdjacentHTML('beforeend', postHtml);
    }
    
    if (hasMorePosts && endIndex < allPostsCache.length) {
        let loadMoreDiv = document.getElementById('loadMoreTrigger');
        if (!loadMoreDiv) {
            loadMoreDiv = document.createElement('div');
            loadMoreDiv.id = 'loadMoreTrigger';
            loadMoreDiv.className = 'load-more-btn';
            loadMoreDiv.innerHTML = 'جاري تحميل المزيد...';
            loadMoreDiv.style.display = 'none';
            feedContainer.appendChild(loadMoreDiv);
        }
    } else if (allPostsCache.length > 0 && endIndex >= allPostsCache.length) {
        const loadMoreDiv = document.getElementById('loadMoreTrigger');
        if (loadMoreDiv) loadMoreDiv.remove();
        const endMessage = document.createElement('div');
        endMessage.style.textAlign = 'center';
        endMessage.style.padding = '20px';
        endMessage.style.color = '#8e8e8e';
        endMessage.innerHTML = '✨ لقد وصلت إلى النهاية ✨';
        feedContainer.appendChild(endMessage);
    }
}

async function createPostCard(post) {
    const userSnapshot = await db.ref(`users/${post.userId}`).once('value');
    const user = userSnapshot.val();
    const isLiked = post.likes && post.likes[currentUser?.uid];
    const likesCount = post.likes ? Object.keys(post.likes).length : 0;
    
    let formattedCaption = escapeHtml(post.caption || '');
    if (post.hashtags) {
        post.hashtags.forEach(tag => {
            const regex = new RegExp(`#${tag}`, 'gi');
            formattedCaption = formattedCaption.replace(regex, `<span class="post-hashtag" onclick="searchHashtag('${tag}')">#${tag}</span>`);
        });
    }
    
    return `
        <div class="post-card fade-in" data-post-id="${post.id}">
            <div class="post-header">
                <div class="post-user" onclick="openProfile('${post.userId}')">
                    <div class="post-avatar">
                        ${post.userAvatar ? `<img src="${post.userAvatar}">` : '<i class="fa-solid fa-user"></i>'}
                    </div>
                    <div>
                        <div class="post-username">${escapeHtml(post.userName)}</div>
                        <div class="post-location">${post.hashtags ? post.hashtags[0] ? '#' + post.hashtags[0] : '' : ''}</div>
                    </div>
                </div>
                <div class="post-menu"><i class="fa-solid fa-ellipsis-vertical"></i></div>
            </div>
            ${post.mediaType === 'image' ? 
                `<img src="${post.mediaUrl}" class="post-image" onclick="viewPost('${post.id}')">` : 
                `<video src="${post.mediaUrl}" class="post-video" controls loop playsinline onclick="this.paused ? this.play() : this.pause()"></video>`
            }
            <div class="post-actions">
                <div class="post-actions-left">
                    <button class="post-action ${isLiked ? 'liked' : ''}" onclick="likePost('${post.id}')"><i class="fa-regular fa-heart"></i></button>
                    <button class="post-action" onclick="openComments('${post.id}')"><i class="fa-regular fa-comment"></i></button>
                    <button class="post-action"><i class="fa-regular fa-paper-plane"></i></button>
                </div>
                <button class="post-action"><i class="fa-regular fa-bookmark"></i></button>
            </div>
            <div class="post-likes">${formatNumber(likesCount)} إعجاب</div>
            <div class="post-caption"><span>${escapeHtml(post.userName)}</span> ${formattedCaption}</div>
            <div class="post-comments" onclick="openComments('${post.id}')">عرض جميع التعليقات (${post.commentsCount || 0})</div>
            <div class="post-time">${formatTime(post.timestamp)}</div>
        </div>
    `;
}

async function loadMorePosts() {
    if (isLoadingMore || !hasMorePosts) return;
    isLoadingMore = true;
    const loadMoreDiv = document.getElementById('loadMoreTrigger');
    if (loadMoreDiv) loadMoreDiv.style.display = 'block';
    
    await new Promise(resolve => setTimeout(resolve, 200));
    const startIndex = currentDisplayCount;
    const newEndIndex = Math.min(startIndex + POSTS_PER_BATCH, allPostsCache.length);
    
    if (startIndex < allPostsCache.length) {
        await displayPosts(startIndex, POSTS_PER_BATCH);
        currentDisplayCount = newEndIndex;
        hasMorePosts = currentDisplayCount < allPostsCache.length;
    } else {
        hasMorePosts = false;
    }
    
    if (loadMoreDiv) loadMoreDiv.style.display = 'none';
    isLoadingMore = false;
}

function setupSmoothScrollListener() {
    const handleScroll = () => {
        if (isLoadingMore || !hasMorePosts) return;
        const scrollPosition = window.innerHeight + window.scrollY;
        const threshold = document.body.offsetHeight - 500;
        if (scrollPosition >= threshold) loadMorePosts();
    };
    window.removeEventListener('scroll', handleScroll);
    window.addEventListener('scroll', handleScroll, { passive: true });
}

async function refreshFeedCache() {
    if (!currentUser) return;
    const snapshot = await db.ref('posts').once('value');
    const posts = snapshot.val();
    if (!posts || Object.keys(posts).length === 0) {
        allPostsCache = [];
        hasMorePosts = false;
        currentDisplayCount = 0;
        document.getElementById('feedContainer').innerHTML = '<div style="text-align: center; padding: 40px; color: #8e8e8e;">✨ لا توجد منشورات بعد - كن أول من ينشر! ✨</div>';
        return;
    }
    let postsArray = Object.values(posts).sort((a, b) => b.timestamp - a.timestamp);
    allPostsCache = postsArray;
    hasMorePosts = allPostsCache.length > POSTS_PER_BATCH;
    currentDisplayCount = Math.min(POSTS_PER_BATCH, allPostsCache.length);
    const feedContainer = document.getElementById('feedContainer');
    if (feedContainer) {
        feedContainer.innerHTML = '';
        await displayPosts(0, currentDisplayCount);
    }
}

function resetInfiniteScroll() {
    isLoadingMore = false;
    hasMorePosts = true;
    allPostsCache = [];
    currentDisplayCount = 0;
    scrollListenerActive = true;
}

async function loadFeed() {
    await loadAllPostsToCache();
}

// ==================== Logout ====================
async function logout() {
    try {
        await auth.signOut();
        window.location.href = 'auth.html';
    } catch (error) {
        showToast(error.message);
    }
}

// ==================== Auth State Listener ====================
auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        const snapshot = await db.ref(`users/${user.uid}`).once('value');
        if (snapshot.exists()) {
            currentUser = { ...currentUser, ...snapshot.val() };
        } else {
            await db.ref(`users/${user.uid}`).set({
                uid: user.uid,
                name: user.displayName || user.email.split('@')[0],
                username: user.displayName || user.email.split('@')[0],
                email: user.email,
                bio: "",
                avatar: "",
                website: "",
                verified: false,
                isAdmin: user.email === ADMIN_EMAIL,
                followers: {},
                following: {},
                createdAt: Date.now()
            });
            currentUser.isAdmin = user.email === ADMIN_EMAIL;
        }
        
        document.getElementById('mainApp').style.display = 'block';
        await loadBadWordsList();
        resetInfiniteScroll();
        await loadFeed();
        await loadStories();
        loadTheme();
        
        // Show admin panel button if admin
        if (currentUser.isAdmin) {
            const adminBtn = document.createElement('button');
            adminBtn.className = 'nav-item';
            adminBtn.innerHTML = '<i class="fa-solid fa-screwdriver-wrench"></i>';
            adminBtn.onclick = () => openAdminPanel();
            document.querySelector('.bottom-nav').appendChild(adminBtn);
        }
    } else {
        window.location.href = 'auth.html';
    }
});
