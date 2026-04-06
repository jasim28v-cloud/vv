// ==================== ZAMN - Instagram Clone with All Features ====================
let currentUser = null;
let currentPostId = null;
let currentCommentId = null;
let currentChatUser = null;
let currentProfileUser = null;
let selectedPostMedia = null;
let selectedMediaType = null;
let currentView = 'home';
let currentReportPostId = null;
let selectedReportReason = null;
let currentStoryId = null;
let currentStoryUserId = null;
let storyProgressInterval = null;
let currentStoriesList = [];
let currentStoryIndex = 0;

// ==================== Voice Recording Variables ====================
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;

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

// ==================== Media Viewer (Lightbox) ====================
function openMediaViewer(url, type) {
    const viewer = document.getElementById('mediaViewer');
    const viewerImage = document.getElementById('viewerImage');
    const viewerVideo = document.getElementById('viewerVideo');
    
    if (type === 'image') {
        viewerImage.style.display = 'block';
        viewerVideo.style.display = 'none';
        viewerImage.src = url;
        viewerVideo.pause();
    } else if (type === 'video') {
        viewerImage.style.display = 'none';
        viewerVideo.style.display = 'block';
        viewerVideo.src = url;
        viewerVideo.load();
        viewerVideo.play();
    }
    
    viewer.classList.add('open');
}

function closeMediaViewer() {
    const viewer = document.getElementById('mediaViewer');
    const viewerVideo = document.getElementById('viewerVideo');
    viewerVideo.pause();
    viewer.classList.remove('open');
}

// ==================== Upload to Cloudinary with Progress ====================
async function uploadToCloudinary(file, onProgress) {
    const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', UPLOAD_PRESET);
    
    const progressContainer = document.getElementById('uploadProgressContainer');
    const progressFill = document.getElementById('uploadProgressFill');
    const progressText = document.getElementById('uploadProgressText');
    
    if (progressContainer) {
        progressContainer.classList.add('active');
        progressFill.style.width = '0%';
        progressText.textContent = '0%';
    }
    
    try {
        let progress = 0;
        const interval = setInterval(() => {
            if (progress < 90) {
                progress += 10;
                if (progressFill) {
                    progressFill.style.width = progress + '%';
                    progressText.textContent = progress + '%';
                }
            }
        }, 200);
        
        const response = await fetch(url, { method: 'POST', body: formData });
        clearInterval(interval);
        
        const data = await response.json();
        if (data.secure_url) {
            if (progressFill) {
                progressFill.style.width = '100%';
                progressText.textContent = '100%';
            }
            setTimeout(() => {
                if (progressContainer) progressContainer.classList.remove('active');
            }, 500);
            return data.secure_url;
        }
        throw new Error('Upload failed');
    } catch (error) {
        console.error('Cloudinary error:', error);
        showToast('فشل رفع الملف');
        if (progressContainer) progressContainer.classList.remove('active');
        return null;
    }
}

// ==================== Voice Recording ====================
async function startVoiceRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        
        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };
        
        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            const audioUrl = await uploadToCloudinary(audioBlob);
            
            if (audioUrl && currentChatUser) {
                const chatId = getChatId(currentUser.uid, currentChatUser.uid);
                await db.ref(`chats/${chatId}`).push({
                    senderId: currentUser.uid,
                    audioUrl: audioUrl,
                    timestamp: Date.now(),
                    read: false
                });
                showToast('🎤 تم إرسال الرسالة الصوتية');
                loadChatMessages(currentChatUser.uid);
            }
            
            stream.getTracks().forEach(track => track.stop());
            document.getElementById('recordingIndicator').style.display = 'none';
        };
        
        mediaRecorder.start();
        isRecording = true;
        document.getElementById('recordingIndicator').style.display = 'flex';
        showToast('🔴 جاري التسجيل... اضغط مرة أخرى للإيقاف');
    } catch (error) {
        console.error('Recording error:', error);
        showToast('❌ لا يمكن الوصول إلى الميكروفون');
    }
}

function stopVoiceRecording() {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        isRecording = false;
    }
}

function toggleVoiceRecording() {
    if (isRecording) {
        stopVoiceRecording();
    } else {
        startVoiceRecording();
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

function extractMentions(text) {
    const mentions = text.match(/@[\w\u0600-\u06FF]+/g) || [];
    return mentions.map(m => m.substring(1));
}

function extractHashtags(text) {
    const hashtags = text.match(/#[\w\u0600-\u06FF]+/g) || [];
    return hashtags.map(t => t.substring(1));
}

async function createPost() {
    if (!selectedPostMedia) {
        showToast('⚠️ الرجاء اختيار صورة أو فيديو');
        return;
    }
    
    const caption = document.getElementById('postCaption').value;
    const mediaUrl = await uploadToCloudinary(selectedPostMedia);
    if (!mediaUrl) return;
    
    const mentions = extractMentions(caption);
    const hashtags = extractHashtags(caption);
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
        mentions: mentions,
        hashtags: hashtags,
        likes: {},
        saves: {},
        comments: {},
        commentsCount: 0,
        timestamp: Date.now()
    });
    
    // Send notifications for mentions
    for (const mention of mentions) {
        const userSnapshot = await db.ref('users').orderByChild('username').equalTo(mention).once('value');
        const mentionedUser = userSnapshot.val();
        if (mentionedUser) {
            const uid = Object.keys(mentionedUser)[0];
            await db.ref(`notifications/${uid}`).push({
                type: 'mention',
                userId: currentUser.uid,
                userName: currentUser.name,
                postId: postRef.key,
                timestamp: Date.now(),
                read: false
            });
            updateNotificationBadge();
        }
    }
    
    document.getElementById('postCaption').value = '';
    selectedPostMedia = null;
    document.getElementById('postPreviewArea').style.display = 'none';
    closeCreatePost();
    await refreshFeedCache();
    showToast('✅ تم نشر المنشور');
}

// ==================== Save Post ====================
async function savePost(postId) {
    const saveRef = db.ref(`saves/${currentUser.uid}/${postId}`);
    const snapshot = await saveRef.once('value');
    const wasSaved = snapshot.exists();
    
    if (wasSaved) {
        await saveRef.remove();
        await db.ref(`posts/${postId}/saves/${currentUser.uid}`).remove();
        showToast('📌 تم إزالة من المحفوظات');
    } else {
        await saveRef.set(true);
        await db.ref(`posts/${postId}/saves/${currentUser.uid}`).set(true);
        showToast('💾 تم حفظ المنشور');
    }
    refreshFeedCache();
}

// ==================== Share Post ====================
async function sharePost(postId) {
    const postSnapshot = await db.ref(`posts/${postId}`).once('value');
    const post = postSnapshot.val();
    const shareRef = db.ref('posts').push();
    
    await shareRef.set({
        id: shareRef.key,
        userId: currentUser.uid,
        userName: currentUser.name,
        userAvatar: currentUser.avatar || "",
        username: currentUser.username,
        caption: `شارك منشور: ${post.caption?.substring(0, 100)}`,
        originalPostId: postId,
        originalUser: post.userName,
        mediaUrl: post.mediaUrl,
        mediaType: post.mediaType,
        likes: {},
        saves: {},
        comments: {},
        commentsCount: 0,
        timestamp: Date.now()
    });
    
    showToast('🔄 تمت المشاركة');
    refreshFeedCache();
}

// ==================== Like Post (with double click) ====================
async function likePost(postId, event) {
    const likeRef = db.ref(`posts/${postId}/likes/${currentUser.uid}`);
    const snapshot = await likeRef.once('value');
    const wasLiked = snapshot.exists();
    
    if (wasLiked) {
        await likeRef.remove();
    } else {
        await likeRef.set(true);
        const postSnapshot = await db.ref(`posts/${postId}`).once('value');
        const post = postSnapshot.val();
        if (post && post.userId !== currentUser.uid) {
            await db.ref(`notifications/${post.userId}`).push({
                type: 'like',
                userId: currentUser.uid,
                userName: currentUser.name,
                postId: postId,
                timestamp: Date.now(),
                read: false
            });
            updateNotificationBadge();
        }
    }
    
    // Update UI without page refresh
    const postCard = document.querySelector(`.post-card[data-post-id="${postId}"]`);
    if (postCard) {
        const likeBtn = postCard.querySelector('.post-actions-left .post-action:first-child');
        const likesSpan = postCard.querySelector('.post-likes');
        
        if (likeBtn) {
            if (!wasLiked) {
                likeBtn.classList.add('liked');
            } else {
                likeBtn.classList.remove('liked');
            }
        }
        
        if (likesSpan) {
            let currentLikes = parseInt(likesSpan.textContent) || 0;
            currentLikes = wasLiked ? currentLikes - 1 : currentLikes + 1;
            likesSpan.textContent = formatNumber(currentLikes) + ' إعجاب';
        }
    }
    
    refreshFeedCache();
}

function handlePostDoubleClick(postId, event) {
    event.stopPropagation();
    likePost(postId, event);
    
    const heart = document.createElement('div');
    heart.innerHTML = '❤️';
    heart.style.position = 'fixed';
    heart.style.left = event.clientX + 'px';
    heart.style.top = event.clientY + 'px';
    heart.style.fontSize = '48px';
    heart.style.color = '#ed4956';
    heart.style.zIndex = '1000';
    heart.style.pointerEvents = 'none';
    heart.style.animation = 'heartbeat 0.3s ease-out';
    document.body.appendChild(heart);
    setTimeout(() => heart.remove(), 500);
}

// ==================== Comments ====================
async function openComments(postId) {
    currentPostId = postId;
    await loadComments(postId);
    document.getElementById('commentsModal').classList.add('open');
}

function closeCommentsModal() {
    document.getElementById('commentsModal').classList.remove('open');
    currentPostId = null;
}

async function loadComments(postId) {
    const snapshot = await db.ref(`posts/${postId}/comments`).once('value');
    const comments = snapshot.val();
    const container = document.getElementById('commentsList');
    
    if (!comments) {
        container.innerHTML = '<div style="text-align: center; padding: 20px; color: #8e8e8e;">لا توجد تعليقات بعد</div>';
        return;
    }
    
    let html = '';
    const commentsArray = Object.values(comments).sort((a, b) => b.timestamp - a.timestamp);
    for (const comment of commentsArray) {
        const userSnapshot = await db.ref(`users/${comment.userId}`).once('value');
        const user = userSnapshot.val();
        const isVerifiedBlue = user?.verified === 'blue';
        const isVerifiedGold = user?.verified === 'gold';
        const isOwner = comment.userId === currentUser.uid;
        
        html += `
            <div id="comment-${comment.id}" style="margin-bottom: 16px;">
                <div style="display: flex; gap: 12px;">
                    <div class="post-avatar" style="width: 32px; height: 32px;" onclick="openProfile('${comment.userId}')">
                        ${comment.userAvatar ? `<img src="${comment.userAvatar}">` : '<i class="fa-solid fa-user"></i>'}
                    </div>
                    <div style="flex: 1;">
                        <div style="font-weight: 600; font-size: 13px; display: flex; align-items: center; gap: 4px; flex-wrap: wrap;">
                            ${escapeHtml(comment.userName)}
                            ${isVerifiedBlue ? '<i class="fa-solid fa-circle-check verified-badge-blue" style="font-size: 12px;"></i>' : ''}
                            ${isVerifiedGold ? '<i class="fa-solid fa-circle-check verified-badge-gold" style="font-size: 12px;"></i>' : ''}
                        </div>
                        <div style="font-size: 13px;">${escapeHtml(comment.text)}</div>
                        <div style="font-size: 10px; color: #8e8e8e; display: flex; gap: 12px; margin-top: 4px;">
                            <span>${formatTime(comment.timestamp)}</span>
                            <button class="reply-btn" onclick="openReplyModal('${comment.id}')" style="background: none; border: none; color: #8e8e8e; font-size: 10px; cursor: pointer;">رد</button>
                            ${isOwner ? `<button onclick="deleteComment('${comment.id}')" style="background: none; border: none; color: #ed4956; font-size: 10px; cursor: pointer;">حذف</button>` : ''}
                        </div>
                    </div>
                </div>
                <div id="replies-${comment.id}" class="reply-thread"></div>
            </div>
        `;
        
        if (comment.replies) {
            const repliesContainer = document.getElementById(`replies-${comment.id}`);
            if (repliesContainer) {
                const repliesArray = Object.values(comment.replies).sort((a, b) => b.timestamp - a.timestamp);
                for (const reply of repliesArray) {
                    const replyUserSnapshot = await db.ref(`users/${reply.userId}`).once('value');
                    const replyUser = replyUserSnapshot.val();
                    const isReplyBlue = replyUser?.verified === 'blue';
                    const isReplyGold = replyUser?.verified === 'gold';
                    repliesContainer.innerHTML += `
                        <div style="display: flex; gap: 12px; margin-top: 12px;">
                            <div class="post-avatar" style="width: 28px; height: 28px;" onclick="openProfile('${reply.userId}')">
                                ${reply.userAvatar ? `<img src="${reply.userAvatar}">` : '<i class="fa-solid fa-user"></i>'}
                            </div>
                            <div style="flex: 1;">
                                <div style="font-weight: 600; font-size: 12px; display: flex; align-items: center; gap: 4px; flex-wrap: wrap;">
                                    ${escapeHtml(reply.userName)}
                                    ${isReplyBlue ? '<i class="fa-solid fa-circle-check verified-badge-blue" style="font-size: 10px;"></i>' : ''}
                                    ${isReplyGold ? '<i class="fa-solid fa-circle-check verified-badge-gold" style="font-size: 10px;"></i>' : ''}
                                </div>
                                <div style="font-size: 12px;">${escapeHtml(reply.text)}</div>
                                <div style="font-size: 10px; color: #8e8e8e;">${formatTime(reply.timestamp)}</div>
                            </div>
                        </div>
                    `;
                }
            }
        }
    }
    container.innerHTML = html;
}

async function addComment() {
    const text = document.getElementById('commentText').value;
    if (!text || !currentPostId) return;
    
    const commentRef = db.ref(`posts/${currentPostId}/comments`).push();
    await commentRef.set({
        id: commentRef.key,
        userId: currentUser.uid,
        userName: currentUser.name,
        userAvatar: currentUser.avatar || "",
        text: text,
        replies: {},
        timestamp: Date.now()
    });
    
    const postRef = db.ref(`posts/${currentPostId}`);
    const snapshot = await postRef.once('value');
    const post = postSnapshot.val();
    await postRef.update({ commentsCount: (post.commentsCount || 0) + 1 });
    
    if (post.userId !== currentUser.uid) {
        await db.ref(`notifications/${post.userId}`).push({
            type: 'comment',
            userId: currentUser.uid,
            userName: currentUser.name,
            postId: currentPostId,
            text: text.substring(0, 50),
            timestamp: Date.now(),
            read: false
        });
        updateNotificationBadge();
    }
    
    document.getElementById('commentText').value = '';
    await loadComments(currentPostId);
    refreshFeedCache();
    showToast('💬 تم إضافة التعليق');
}

// ==================== Reply to Comment ====================
let currentReplyCommentId = null;

function openReplyModal(commentId) {
    currentReplyCommentId = commentId;
    document.getElementById('replyModal').classList.add('open');
}

function closeReplyModal() {
    document.getElementById('replyModal').classList.remove('open');
    currentReplyCommentId = null;
    document.getElementById('replyText').value = '';
}

async function addReply() {
    const text = document.getElementById('replyText').value;
    if (!text || !currentPostId || !currentReplyCommentId) return;
    
    const replyRef = db.ref(`posts/${currentPostId}/comments/${currentReplyCommentId}/replies`).push();
    await replyRef.set({
        userId: currentUser.uid,
        userName: currentUser.name,
        userAvatar: currentUser.avatar || "",
        text: text,
        timestamp: Date.now()
    });
    
    closeReplyModal();
    await loadComments(currentPostId);
    showToast('💬 تم إضافة الرد');
}

async function deleteComment(commentId) {
    if (confirm('⚠️ هل أنت متأكد من حذف هذا التعليق؟')) {
        await db.ref(`posts/${currentPostId}/comments/${commentId}`).remove();
        await loadComments(currentPostId);
        showToast('🗑️ تم حذف التعليق');
    }
}

// ==================== Report Post ====================
function openReportModal(postId) {
    currentReportPostId = postId;
    selectedReportReason = null;
    document.querySelectorAll('.report-reason').forEach(el => {
        el.style.background = '#EFEFEF';
        el.style.color = '#262626';
    });
    document.getElementById('reportModal').classList.add('open');
}

function selectReportReason(reason) {
    selectedReportReason = reason;
    document.querySelectorAll('.report-reason').forEach(el => {
        if (el.textContent === reason) {
            el.style.background = '#0095f6';
            el.style.color = 'white';
        } else {
            el.style.background = '#EFEFEF';
            el.style.color = '#262626';
        }
    });
}

function closeReportModal() {
    document.getElementById('reportModal').classList.remove('open');
    currentReportPostId = null;
    selectedReportReason = null;
}

async function submitReport() {
    if (!selectedReportReason || !currentReportPostId) {
        showToast('الرجاء اختيار سبب الإبلاغ');
        return;
    }
    await db.ref(`reports/${currentReportPostId}`).push({
        reporterId: currentUser.uid,
        reporterName: currentUser.name,
        reason: selectedReportReason,
        timestamp: Date.now()
    });
    showToast('📢 تم إرسال البلاغ، شكراً لك');
    closeReportModal();
    if (currentUser.isAdmin) loadAdminReports();
}

// ==================== Block User ====================
async function blockUser(userId) {
    if (confirm('⚠️ هل أنت متأكد من حظر هذا المستخدم؟')) {
        await db.ref(`blocks/${currentUser.uid}/${userId}`).set(true);
        showToast('🚫 تم حظر المستخدم');
        refreshFeedCache();
        if (currentProfileUser === userId) closeProfile();
    }
}

async function unblockUser(userId) {
    await db.ref(`blocks/${currentUser.uid}/${userId}`).remove();
    showToast('✅ تم إلغاء حظر المستخدم');
    refreshFeedCache();
}

async function isBlocked(userId) {
    const snapshot = await db.ref(`blocks/${currentUser.uid}/${userId}`).once('value');
    return snapshot.exists();
}

// ==================== Search ====================
async function searchAll() {
    const query = document.getElementById('searchInput').value.toLowerCase();
    const searchResults = document.getElementById('searchResults');
    const feedContainer = document.getElementById('feedContainer');
    
    if (!query) {
        searchResults.style.display = 'none';
        feedContainer.style.display = 'block';
        return;
    }
    
    searchResults.style.display = 'block';
    feedContainer.style.display = 'none';
    
    const usersSnapshot = await db.ref('users').once('value');
    const users = usersSnapshot.val();
    let userResults = [];
    if (users) {
        userResults = Object.values(users).filter(u => 
            u.name?.toLowerCase().includes(query) || 
            u.username?.toLowerCase().includes(query) ||
            u.email?.toLowerCase().includes(query)
        );
    }
    
    const postsSnapshot = await db.ref('posts').once('value');
    const posts = postsSnapshot.val();
    let hashtagResults = new Set();
    if (posts) {
        Object.values(posts).forEach(post => {
            if (post.hashtags) {
                post.hashtags.forEach(tag => {
                    if (tag.toLowerCase().includes(query)) {
                        hashtagResults.add(tag);
                    }
                });
            }
        });
    }
    
    let html = '<div class="search-results">';
    
    if (userResults.length > 0) {
        html += '<div style="font-weight: 600; margin: 12px;">👥 مستخدمين</div>';
        for (const user of userResults.slice(0, 10)) {
            const isVerifiedBlue = user.verified === 'blue';
            const isVerifiedGold = user.verified === 'gold';
            html += `
                <div class="search-result-item" onclick="openProfile('${user.uid}')">
                    <div class="post-avatar" style="width: 44px; height: 44px;">
                        ${user.avatar ? `<img src="${user.avatar}">` : '<i class="fa-solid fa-user"></i>'}
                    </div>
                    <div>
                        <div style="font-weight: 600; display: flex; align-items: center; gap: 4px; flex-wrap: wrap;">
                            ${escapeHtml(user.name)}
                            ${isVerifiedBlue ? '<i class="fa-solid fa-circle-check verified-badge-blue" style="font-size: 12px;"></i>' : ''}
                            ${isVerifiedGold ? '<i class="fa-solid fa-circle-check verified-badge-gold" style="font-size: 12px;"></i>' : ''}
                        </div>
                        <div style="color: #8e8e8e; font-size: 12px;">@${escapeHtml(user.username || user.name)}</div>
                    </div>
                </div>
            `;
        }
    }
    
    if (hashtagResults.size > 0) {
        html += '<div style="font-weight: 600; margin: 12px;">🏷️ هاشتاجات</div>';
        for (const tag of hashtagResults) {
            html += `
                <div class="search-result-item" onclick="searchHashtag('${tag}')">
                    <div class="post-avatar" style="width: 44px; height: 44px; background: #0095f6; display: flex; align-items: center; justify-content: center;">
                        <i class="fa-solid fa-hashtag" style="color: white;"></i>
                    </div>
                    <div>
                        <div style="font-weight: 600; color: #0095f6;">#${escapeHtml(tag)}</div>
                    </div>
                </div>
            `;
        }
    }
    
    if (userResults.length === 0 && hashtagResults.size === 0) {
        html += '<div style="text-align: center; padding: 40px; color: #8e8e8e;">لا توجد نتائج</div>';
    }
    
    html += '</div>';
    searchResults.innerHTML = html;
}

async function searchHashtag(tag) {
    document.getElementById('searchInput').value = `#${tag}`;
    await searchAll();
}

async function searchUser(username) {
    document.getElementById('searchInput').value = username;
    await searchAll();
}

// ==================== Notifications ====================
async function loadNotifications() {
    if (!currentUser) return;
    db.ref(`notifications/${currentUser.uid}`).on('value', (snapshot) => {
        updateNotificationBadge();
    });
}

function updateNotificationBadge() {
    const notifIcon = document.getElementById('notificationsIcon');
    if (notifIcon) {
        db.ref(`notifications/${currentUser.uid}`).once('value', (snapshot) => {
            const notifications = snapshot.val();
            const existingBadge = notifIcon.querySelector('.notification-badge');
            if (notifications) {
                const unread = Object.values(notifications).filter(n => !n.read).length;
                if (unread > 0) {
                    if (!existingBadge) {
                        const badge = document.createElement('div');
                        badge.className = 'notification-badge';
                        badge.textContent = unread;
                        notifIcon.style.position = 'relative';
                        notifIcon.appendChild(badge);
                    } else {
                        existingBadge.textContent = unread;
                    }
                } else if (existingBadge) {
                    existingBadge.remove();
                }
            } else if (existingBadge) {
                existingBadge.remove();
            }
        });
    }
}

async function openNotifications() {
    const snapshot = await db.ref(`notifications/${currentUser.uid}`).once('value');
    const notifications = snapshot.val();
    const container = document.getElementById('notificationsList');
    
    if (!notifications) {
        container.innerHTML = '<div style="text-align: center; padding: 40px; color: #8e8e8e;">لا توجد إشعارات</div>';
    } else {
        let html = '';
        const sorted = Object.entries(notifications).sort((a, b) => b[1].timestamp - a[1].timestamp);
        for (const [id, notif] of sorted) {
            let actionText = '';
            let icon = '';
            if (notif.type === 'like') {
                actionText = 'أعجب بمنشورك';
                icon = 'fa-heart';
            } else if (notif.type === 'comment') {
                actionText = `علق على منشورك: "${notif.text}"`;
                icon = 'fa-comment';
            } else if (notif.type === 'mention') {
                actionText = `أشار إليك في منشور`;
                icon = 'fa-at';
            } else if (notif.type === 'follow') {
                actionText = 'بدأ بمتابعتك';
                icon = 'fa-user-plus';
            }
            
            html += `
                <div class="notification-item" onclick="markNotificationRead('${id}'); ${notif.type === 'follow' ? `openProfile('${notif.userId}')` : `openComments('${notif.postId}')`}; closeNotificationsModal();">
                    <div class="notification-avatar">
                        <i class="fa-solid ${icon}" style="color: white;"></i>
                    </div>
                    <div class="notification-content">
                        <div class="notification-text"><span style="font-weight: 600;">${escapeHtml(notif.userName)}</span> ${actionText}</div>
                        <div class="notification-time">${formatTime(notif.timestamp)}</div>
                    </div>
                </div>
            `;
        }
        container.innerHTML = html;
    }
    
    document.getElementById('notificationsModal').classList.add('open');
    
    const updates = {};
    for (const id of Object.keys(notifications)) {
        updates[`notifications/${currentUser.uid}/${id}/read`] = true;
    }
    await db.ref().update(updates);
    updateNotificationBadge();
}

function closeNotificationsModal() {
    document.getElementById('notificationsModal').classList.remove('open');
}

async function markNotificationRead(notifId) {
    await db.ref(`notifications/${currentUser.uid}/${notifId}`).update({ read: true });
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
                if (user && !await isBlocked(story.userId)) {
                    const isVerifiedBlue = user.verified === 'blue';
                    const isVerifiedGold = user.verified === 'gold';
                    html += `
                        <div class="story-item" onclick="viewStory('${id}', '${story.userId}')">
                            <div class="story-ring">
                                <div class="story-avatar">
                                    ${story.mediaType === 'image' ? `<img src="${story.mediaUrl}">` : `<video src="${story.mediaUrl}" style="width:100%;height:100%;object-fit:cover;"></video>`}
                                </div>
                            </div>
                            <div class="story-name">
                                ${escapeHtml(user.name)}
                                ${isVerifiedBlue ? '<i class="fa-solid fa-circle-check verified-badge-blue" style="font-size: 10px;"></i>' : ''}
                                ${isVerifiedGold ? '<i class="fa-solid fa-circle-check verified-badge-gold" style="font-size: 10px;"></i>' : ''}
                            </div>
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

async function viewStory(storyId, userId) {
    const storySnapshot = await db.ref(`stories/${storyId}`).once('value');
    const story = storySnapshot.val();
    if (!story) return;
    
    const userSnapshot = await db.ref(`users/${userId}`).once('value');
    const user = userSnapshot.val();
    
    // Get all stories from this user
    const allStoriesSnapshot = await db.ref('stories').once('value');
    const allStories = allStoriesSnapshot.val();
    currentStoriesList = [];
    for (const [id, s] of Object.entries(allStories)) {
        if (s.userId === userId && Date.now() - s.timestamp < 86400000) {
            currentStoriesList.push({ id, ...s });
        }
    }
    currentStoriesList.sort((a, b) => a.timestamp - b.timestamp);
    currentStoryIndex = currentStoriesList.findIndex(s => s.id === storyId);
    
    currentStoryUserId = userId;
    currentStoryId = storyId;
    
    const viewer = document.getElementById('storyViewer');
    const storyImage = document.getElementById('storyImage');
    const storyVideo = document.getElementById('storyVideo');
    const storyViewerAvatar = document.getElementById('storyViewerAvatar');
    const storyViewerName = document.getElementById('storyViewerName');
    const storyViewerTime = document.getElementById('storyViewerTime');
    
    storyViewerAvatar.innerHTML = user.avatar ? `<img src="${user.avatar}">` : '<i class="fa-solid fa-user"></i>';
    storyViewerName.innerHTML = escapeHtml(user.name);
    storyViewerTime.innerHTML = formatTime(story.timestamp);
    
    if (story.mediaType === 'image') {
        storyImage.style.display = 'block';
        storyVideo.style.display = 'none';
        storyImage.src = story.mediaUrl;
    } else {
        storyImage.style.display = 'none';
        storyVideo.style.display = 'block';
        storyVideo.src = story.mediaUrl;
        storyVideo.play();
    }
    
    // Create progress bars
    const progressContainer = document.getElementById('storyProgressContainer');
    progressContainer.innerHTML = '';
    currentStoriesList.forEach((s, index) => {
        const progressBar = document.createElement('div');
        progressBar.className = 'story-progress-bar';
        const fill = document.createElement('div');
        fill.className = 'story-progress-fill';
        if (index === currentStoryIndex) {
            fill.style.transition = 'width 5s linear';
            setTimeout(() => { fill.style.width = '100%'; }, 100);
        }
        progressBar.appendChild(fill);
        progressContainer.appendChild(progressBar);
    });
    
    viewer.classList.add('open');
    
    if (storyProgressInterval) clearInterval(storyProgressInterval);
    storyProgressInterval = setTimeout(() => {
        nextStory();
    }, 5000);
}

function nextStory() {
    if (currentStoryIndex < currentStoriesList.length - 1) {
        currentStoryIndex++;
        const nextStory = currentStoriesList[currentStoryIndex];
        viewStory(nextStory.id, nextStory.userId);
    } else {
        closeStoryViewer();
    }
}

function closeStoryViewer() {
    const viewer = document.getElementById('storyViewer');
    const storyVideo = document.getElementById('storyVideo');
    storyVideo.pause();
    viewer.classList.remove('open');
    if (storyProgressInterval) clearInterval(storyProgressInterval);
}

function likeStory() {
    const likeBtn = document.getElementById('storyLikeBtn');
    likeBtn.classList.toggle('liked');
    if (likeBtn.classList.contains('liked')) {
        likeBtn.innerHTML = '<i class="fa-solid fa-heart"></i>';
        showToast('❤️ تم الإعجاب بالقصة');
    } else {
        likeBtn.innerHTML = '<i class="fa-regular fa-heart"></i>';
    }
}

function sendStoryMessage() {
    showToast('💬 أرسل رسالة إلى ${storyViewerName}');
}

// ==================== Reels ====================
async function loadReels() {
    const snapshot = await db.ref('posts').once('value');
    const posts = snapshot.val();
    if (!posts) return;
    
    const reelsList = Object.values(posts).filter(p => p.mediaType === 'video').sort((a, b) => b.timestamp - a.timestamp);
    const container = document.getElementById('reelsContainer');
    if (!container) return;
    
    if (reelsList.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 40px; color: #8e8e8e;">لا توجد ريلز بعد</div>';
        return;
    }
    
    let html = '';
    for (const reel of reelsList) {
        if (await isBlocked(reel.userId)) continue;
        const userSnapshot = await db.ref(`users/${reel.userId}`).once('value');
        const user = userSnapshot.val();
        const isVerifiedBlue = user?.verified === 'blue';
        const isVerifiedGold = user?.verified === 'gold';
        const isLiked = reel.likes && reel.likes[currentUser?.uid];
        const isSaved = reel.saves && reel.saves[currentUser?.uid];
        const likesCount = reel.likes ? Object.keys(reel.likes).length : 0;
        
        html += `
            <div class="post-card" data-post-id="${reel.id}" style="margin-bottom: 16px;">
                <div class="post-header">
                    <div class="post-user" onclick="openProfile('${reel.userId}')">
                        <div class="post-avatar">
                            ${reel.userAvatar ? `<img src="${reel.userAvatar}">` : '<i class="fa-solid fa-user"></i>'}
                        </div>
                        <div>
                            <div class="post-name">
                                ${escapeHtml(reel.userName)}
                                ${isVerifiedBlue ? '<i class="fa-solid fa-circle-check verified-badge-blue" style="font-size: 14px;"></i>' : ''}
                                ${isVerifiedGold ? '<i class="fa-solid fa-circle-check verified-badge-gold" style="font-size: 14px;"></i>' : ''}
                            </div>
                            <div class="post-location">${reel.hashtags ? reel.hashtags[0] ? '#' + reel.hashtags[0] : '' : ''}</div>
                        </div>
                    </div>
                    <div class="post-menu" onclick="toggleMenu(event, '${reel.id}')">
                        <i class="fa-solid fa-ellipsis-vertical"></i>
                        <div class="menu-dropdown" id="menu-${reel.id}">
                            ${reel.userId === currentUser.uid ? `<div class="menu-dropdown-item" onclick="deletePost('${reel.id}')">🗑️ حذف</div>` : ''}
                            ${reel.userId !== currentUser.uid ? `<div class="menu-dropdown-item" onclick="blockUser('${reel.userId}')">🚫 حظر المستخدم</div>` : ''}
                            ${reel.userId !== currentUser.uid ? `<div class="menu-dropdown-item" onclick="openReportModal('${reel.id}')">🚨 إبلاغ</div>` : ''}
                        </div>
                    </div>
                </div>
                <video src="${reel.mediaUrl}" class="post-video" controls loop playsinline ondblclick="handlePostDoubleClick('${reel.id}', event)"></video>
                <div class="post-actions">
                    <div class="post-actions-left">
                        <button class="post-action ${isLiked ? 'liked' : ''}" onclick="likePost('${reel.id}', event)"><i class="fa-regular fa-heart"></i></button>
                        <button class="post-action" onclick="openComments('${reel.id}')"><i class="fa-regular fa-comment"></i></button>
                        <button class="post-action" onclick="sharePost('${reel.id}')"><i class="fa-regular fa-paper-plane"></i></button>
                    </div>
                    <button class="post-action ${isSaved ? 'saved' : ''}" onclick="savePost('${reel.id}')"><i class="fa-regular fa-bookmark"></i></button>
                </div>
                <div class="post-likes">${formatNumber(likesCount)} إعجاب</div>
                <div class="post-caption"><span>${escapeHtml(reel.userName)}</span> ${formatCaptionWithMentionsAndHashtags(escapeHtml(reel.caption || ''))}</div>
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
        if (await isBlocked(post.userId)) continue;
        html += `
            <div class="grid-item" onclick="openComments('${post.id}')">
                ${post.mediaType === 'image' ? 
                    `<img src="${post.mediaUrl}" loading="lazy">` : 
                    `<video src="${post.mediaUrl}" style="width:100%;height:100%;object-fit:cover;"></video>`
                }
            </div>
        `;
    }
    container.innerHTML = html;
}

// ==================== Profile ====================
async function openMyProfile() {
    if (currentUser) openProfile(currentUser.uid);
}

async function openProfile(userId) {
    if (await isBlocked(userId)) {
        showToast('🚫 لا يمكنك عرض هذا الملف');
        return;
    }
    
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
    const isUserBlocked = await isBlocked(userId);
    const isVerifiedBlue = user.verified === 'blue';
    const isVerifiedGold = user.verified === 'gold';
    
    const profileHtml = `
        <div class="profile-header">
            <div class="profile-avatar-large" onclick="${isOwner ? "document.getElementById('avatarInput').click()" : ""}" style="cursor: ${isOwner ? 'pointer' : 'default'}">
                ${user.avatar ? `<img src="${user.avatar}">` : '<i class="fa-solid fa-user fa-3x" style="margin: 25px;"></i>'}
            </div>
            <div class="profile-info">
                <div class="profile-name">
                    ${escapeHtml(user.name)}
                    ${isVerifiedBlue ? '<i class="fa-solid fa-circle-check verified-badge-blue" style="font-size: 18px;"></i>' : ''}
                    ${isVerifiedGold ? '<i class="fa-solid fa-circle-check verified-badge-gold" style="font-size: 18px;"></i>' : ''}
                </div>
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
                    ${!isOwner ? `<button class="profile-btn" onclick="blockUser('${userId}')" style="color: #ed4956;">${isUserBlocked ? 'إلغاء الحظر' : 'حظر'}</button>` : ''}
                    ${isOwner ? `<button class="profile-btn" onclick="openEditProfile()">تعديل الملف</button>` : ''}
                    ${isOwner ? `<button class="profile-btn profile-logout-btn" onclick="logout()">تسجيل الخروج</button>` : ''}
                    ${currentUser.isAdmin && !isOwner ? `<button class="verify-blue-btn" onclick="verifyUser('${userId}', 'blue')">✅ توثيق أزرق</button>` : ''}
                    ${currentUser.isAdmin && !isOwner ? `<button class="verify-gold-btn" onclick="verifyUser('${userId}', 'gold')">👑 توثيق ذهبي</button>` : ''}
                    ${currentUser.isAdmin && !isOwner ? `<button class="profile-btn" onclick="deleteUser('${userId}')" style="color: #ed4956;">حذف</button>` : ''}
                </div>
            </div>
        </div>
        <div class="profile-tabs">
            <button class="profile-tab active" onclick="loadUserPosts('${userId}')"><i class="fa-solid fa-table-cells-large"></i></button>
            <button class="profile-tab" onclick="loadUserReels('${userId}')"><i class="fa-solid fa-clapperboard"></i></button>
            <button class="profile-tab" onclick="loadUserSaved('${userId}')"><i class="fa-regular fa-bookmark"></i></button>
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
            <div class="grid-item" onclick="openComments('${post.id}')">
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
            <div class="grid-item" onclick="openComments('${reel.id}')">
                <video src="${reel.mediaUrl}" style="width:100%;height:100%;object-fit:cover;"></video>
            </div>
        `;
    }
    document.getElementById('userPostsGrid').innerHTML = html || '<div style="text-align: center; padding: 40px;">لا توجد ريلز</div>';
}

async function loadUserSaved(userId) {
    if (userId !== currentUser.uid) {
        document.getElementById('userPostsGrid').innerHTML = '<div style="text-align: center; padding: 40px;">هذا الملف خاص</div>';
        return;
    }
    
    const savesSnapshot = await db.ref(`saves/${currentUser.uid}`).once('value');
    const saves = savesSnapshot.val();
    if (!saves) {
        document.getElementById('userPostsGrid').innerHTML = '<div style="text-align: center; padding: 40px;">لا توجد منشورات محفوظة</div>';
        return;
    }
    
    let html = '';
    for (const postId of Object.keys(saves)) {
        const postSnapshot = await db.ref(`posts/${postId}`).once('value');
        const post = postSnapshot.val();
        if (post) {
            html += `
                <div class="grid-item" onclick="openComments('${post.id}')">
                    ${post.mediaType === 'image' ? 
                        `<img src="${post.mediaUrl}" loading="lazy">` : 
                        `<video src="${post.mediaUrl}" style="width:100%;height:100%;object-fit:cover;"></video>`
                    }
                </div>
            `;
        }
    }
    document.getElementById('userPostsGrid').innerHTML = html || '<div style="text-align: center; padding: 40px;">لا توجد منشورات محفوظة</div>';
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
        await db.ref(`notifications/${userId}`).push({
            type: 'follow',
            userId: currentUser.uid,
            userName: currentUser.name,
            timestamp: Date.now(),
            read: false
        });
        updateNotificationBadge();
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
        if (user && !await isBlocked(uid)) {
            const isVerifiedBlue = user.verified === 'blue';
            const isVerifiedGold = user.verified === 'gold';
            html += `
                <div class="search-result-item" onclick="openProfile('${uid}'); this.closest('.modal-overlay').remove();">
                    <div class="post-avatar" style="width: 44px; height: 44px;">
                        ${user.avatar ? `<img src="${user.avatar}">` : '<i class="fa-solid fa-user"></i>'}
                    </div>
                    <div>
                        <div style="font-weight: 600; display: flex; align-items: center; gap: 4px; flex-wrap: wrap;">
                            ${escapeHtml(user.name)}
                            ${isVerifiedBlue ? '<i class="fa-solid fa-circle-check verified-badge-blue" style="font-size: 12px;"></i>' : ''}
                            ${isVerifiedGold ? '<i class="fa-solid fa-circle-check verified-badge-gold" style="font-size: 12px;"></i>' : ''}
                        </div>
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
            if (await isBlocked(otherUserId)) continue;
            const userSnapshot = await db.ref(`users/${otherUserId}`).once('value');
            const userData = userSnapshot.val();
            const messagesArray = Object.values(messages);
            const lastMessage = messagesArray.sort((a, b) => b.timestamp - a.timestamp)[0];
            conversations.push({ userId: otherUserId, userData, lastMessage, timestamp: lastMessage.timestamp });
        }
        conversations.sort((a, b) => b.timestamp - a.timestamp);
        
        let html = '';
        for (const conv of conversations) {
            const isVerifiedBlue = conv.userData?.verified === 'blue';
            const isVerifiedGold = conv.userData?.verified === 'gold';
            html += `
                <div class="search-result-item" onclick="openChat('${conv.userId}')">
                    <div class="post-avatar" style="width: 44px; height: 44px;">
                        ${conv.userData?.avatar ? `<img src="${conv.userData.avatar}">` : '<i class="fa-solid fa-user"></i>'}
                    </div>
                    <div style="flex: 1;">
                        <div style="font-weight: 600; display: flex; align-items: center; gap: 4px; flex-wrap: wrap;">
                            ${escapeHtml(conv.userData?.name || 'مستخدم')}
                            ${isVerifiedBlue ? '<i class="fa-solid fa-circle-check verified-badge-blue" style="font-size: 12px;"></i>' : ''}
                            ${isVerifiedGold ? '<i class="fa-solid fa-circle-check verified-badge-gold" style="font-size: 12px;"></i>' : ''}
                        </div>
                        <div style="font-size: 12px; color: #8e8e8e;">${conv.lastMessage.text ? conv.lastMessage.text.substring(0, 30) : (conv.lastMessage.imageUrl ? 'صورة' : (conv.lastMessage.audioUrl ? 'رسالة صوتية' : ''))}</div>
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
    if (await isBlocked(userId)) {
        showToast('🚫 لا يمكنك مراسلة هذا المستخدم');
        return;
    }
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
    if (isRecording) stopVoiceRecording();
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
                    ${msg.imageUrl ? `<img src="${msg.imageUrl}" class="dm-message-image" onclick="openMediaViewer('${msg.imageUrl}', 'image')">` : ''}
                    ${msg.audioUrl ? `<div class="audio-message"><i class="fa-solid fa-headphones"></i><audio controls src="${msg.audioUrl}"></audio></div>` : ''}
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
            loadChatMessages(currentChatUser.uid);
        }
    }
    input.value = '';
}

// ==================== Delete Post ====================
async function deletePost(postId) {
    if (confirm('⚠️ هل أنت متأكد من حذف هذا المنشور؟')) {
        await db.ref(`posts/${postId}`).remove();
        await refreshFeedCache();
        if (currentView === 'reels') loadReels();
        if (currentProfileUser) loadUserPosts(currentProfileUser);
        showToast('🗑️ تم حذف المنشور');
    }
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
                const isVerifiedBlue = user.verified === 'blue';
                const isVerifiedGold = user.verified === 'gold';
                usersHtml += `
                    <div class="admin-item">
                        <div>
                            <div style="font-weight: 600; display: flex; align-items: center; gap: 4px; flex-wrap: wrap;">
                                ${escapeHtml(user.name)}
                                ${isVerifiedBlue ? '<i class="fa-solid fa-circle-check verified-badge-blue" style="font-size: 12px;"></i>' : ''}
                                ${isVerifiedGold ? '<i class="fa-solid fa-circle-check verified-badge-gold" style="font-size: 12px;"></i>' : ''}
                            </div>
                            <div style="font-size: 12px; color: #8e8e8e;">${escapeHtml(user.email)}</div>
                        </div>
                        <div>
                            <button class="verify-blue-btn" onclick="verifyUser('${uid}', 'blue')">✅ توثيق أزرق</button>
                            <button class="verify-gold-btn" onclick="verifyUser('${uid}', 'gold')">👑 توثيق ذهبي</button>
                            <button class="profile-btn" onclick="deleteUser('${uid}')" style="background: #ed4956; color: white; padding: 4px 12px;">حذف</button>
                        </div>
                    </div>
                `;
            }
        }
    }
    document.getElementById('adminUsersList').innerHTML = usersHtml || '<div style="padding: 12px; color: #8e8e8e;">لا يوجد مستخدمين</div>';
    
    await loadAdminReports();
    document.getElementById('adminPanel').classList.add('open');
}

function closeAdmin() {
    document.getElementById('adminPanel').classList.remove('open');
}

async function verifyUser(userId, type) {
    await db.ref(`users/${userId}`).update({ verified: type });
    showToast(`✅ تم توثيق المستخدم ${type === 'blue' ? 'بعلامة زرقاء' : 'بعلامة ذهبية'}`);
    if (currentProfileUser === userId) openProfile(userId);
    refreshFeedCache();
    openAdminPanel();
}

async function loadAdminReports() {
    const reportsSnapshot = await db.ref('reports').once('value');
    const reports = reportsSnapshot.val();
    const container = document.getElementById('adminReportsList');
    if (!container) return;
    
    if (!reports) {
        container.innerHTML = '<div style="padding: 12px; color: #8e8e8e;">لا توجد بلاغات</div>';
        return;
    }
    
    let html = '';
    for (const [postId, postReports] of Object.entries(reports)) {
        const reportCount = Object.keys(postReports).length;
        html += `
            <div class="admin-item">
                <div>
                    <div style="font-weight: 600;">منشور: ${postId.substring(0, 8)}...</div>
                    <div style="font-size: 12px; color: #8e8e8e;">${reportCount} بلاغ</div>
                </div>
                <button class="profile-btn" onclick="deletePost('${postId}')" style="background: #ed4956; color: white; padding: 4px 12px;">حذف المنشور</button>
            </div>
        `;
    }
    container.innerHTML = html;
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
    const progressContainer = document.getElementById('uploadProgressContainer');
    if (progressContainer) progressContainer.classList.remove('active');
}

// ==================== Menu Dropdown ====================
function toggleMenu(event, postId) {
    event.stopPropagation();
    const menu = document.getElementById(`menu-${postId}`);
    document.querySelectorAll('.menu-dropdown').forEach(m => {
        if (m.id !== `menu-${postId}`) m.classList.remove('show');
    });
    menu.classList.toggle('show');
}

document.addEventListener('click', () => {
    document.querySelectorAll('.menu-dropdown').forEach(m => m.classList.remove('show'));
});

// ==================== Format Caption ====================
function formatCaptionWithMentionsAndHashtags(caption) {
    let formatted = caption;
    formatted = formatted.replace(/@(\w+)/g, '<span class="post-mention" onclick="searchUser(\'$1\')">@$1</span>');
    formatted = formatted.replace(/#(\w+)/g, '<span class="post-hashtag" onclick="searchHashtag(\'$1\')">#$1</span>');
    return formatted;
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
    
    const blockedUsers = await getBlockedUsers();
    postsArray = postsArray.filter(post => !blockedUsers.includes(post.userId));
    
    allPostsCache = postsArray;
    hasMorePosts = allPostsCache.length > POSTS_PER_BATCH;
    currentDisplayCount = POSTS_PER_BATCH;
    
    feedContainer.innerHTML = '';
    await displayPosts(0, POSTS_PER_BATCH);
    
    if (scrollListenerActive) setupSmoothScrollListener();
}

async function getBlockedUsers() {
    const snapshot = await db.ref(`blocks/${currentUser.uid}`).once('value');
    const blocks = snapshot.val();
    return blocks ? Object.keys(blocks) : [];
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
    const isVerifiedBlue = user?.verified === 'blue';
    const isVerifiedGold = user?.verified === 'gold';
    const isLiked = post.likes && post.likes[currentUser?.uid];
    const isSaved = post.saves && post.saves[currentUser?.uid];
    const likesCount = post.likes ? Object.keys(post.likes).length : 0;
    const isOwner = post.userId === currentUser?.uid;
    
    let formattedCaption = escapeHtml(post.caption || '');
    formattedCaption = formatCaptionWithMentionsAndHashtags(formattedCaption);
    
    return `
        <div class="post-card fade-in" data-post-id="${post.id}">
            <div class="post-header">
                <div class="post-user" onclick="openProfile('${post.userId}')">
                    <div class="post-avatar">
                        ${post.userAvatar ? `<img src="${post.userAvatar}">` : '<i class="fa-solid fa-user"></i>'}
                    </div>
                    <div>
                        <div class="post-name">
                            ${escapeHtml(post.userName)}
                            ${isVerifiedBlue ? '<i class="fa-solid fa-circle-check verified-badge-blue" style="font-size: 14px;"></i>' : ''}
                            ${isVerifiedGold ? '<i class="fa-solid fa-circle-check verified-badge-gold" style="font-size: 14px;"></i>' : ''}
                        </div>
                        <div class="post-location">${post.hashtags ? post.hashtags[0] ? '#' + post.hashtags[0] : '' : ''}</div>
                    </div>
                </div>
                <div class="post-menu" onclick="toggleMenu(event, '${post.id}')">
                    <i class="fa-solid fa-ellipsis-vertical"></i>
                    <div class="menu-dropdown" id="menu-${post.id}">
                        ${isOwner ? `<div class="menu-dropdown-item" onclick="deletePost('${post.id}')">🗑️ حذف</div>` : ''}
                        ${!isOwner ? `<div class="menu-dropdown-item" onclick="blockUser('${post.userId}')">🚫 حظر المستخدم</div>` : ''}
                        ${!isOwner ? `<div class="menu-dropdown-item" onclick="openReportModal('${post.id}')">🚨 إبلاغ</div>` : ''}
                    </div>
                </div>
            </div>
            ${post.mediaType === 'image' ? 
                `<img src="${post.mediaUrl}" class="post-image" onclick="openMediaViewer('${post.mediaUrl}', 'image')" ondblclick="handlePostDoubleClick('${post.id}', event)">` : 
                `<video src="${post.mediaUrl}" class="post-video" controls loop playsinline onclick="this.paused ? this.play() : this.pause()" ondblclick="handlePostDoubleClick('${post.id}', event)"></video>`
            }
            <div class="post-actions">
                <div class="post-actions-left">
                    <button class="post-action ${isLiked ? 'liked' : ''}" onclick="likePost('${post.id}', event)"><i class="fa-regular fa-heart"></i></button>
                    <button class="post-action" onclick="openComments('${post.id}')"><i class="fa-regular fa-comment"></i></button>
                    <button class="post-action" onclick="sharePost('${post.id}')"><i class="fa-regular fa-paper-plane"></i></button>
                </div>
                <button class="post-action ${isSaved ? 'saved' : ''}" onclick="savePost('${post.id}')"><i class="fa-regular fa-bookmark"></i></button>
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
    const blockedUsers = await getBlockedUsers();
    postsArray = postsArray.filter(post => !blockedUsers.includes(post.userId));
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
        loadNotifications();
        
        // Show admin button if admin
        if (currentUser.isAdmin) {
            const bottomNav = document.querySelector('.bottom-nav');
            if (!document.getElementById('adminNavBtn')) {
                const adminBtn = document.createElement('button');
                adminBtn.id = 'adminNavBtn';
                adminBtn.className = 'nav-item';
                adminBtn.innerHTML = '<i class="fa-solid fa-screwdriver-wrench"></i>';
                adminBtn.onclick = () => openAdminPanel();
                bottomNav.appendChild(adminBtn);
            }
        }
    } else {
        window.location.href = 'auth.html';
    }
});
