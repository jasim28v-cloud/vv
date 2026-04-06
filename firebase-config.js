// ==================== ZAMN - Instagram Clone Configuration ====================
const firebaseConfig = {
    apiKey: "AIzaSyAYB11nrt46mDc-YBLMgj3VLswl5GgiNDU",
    authDomain: "zamn-208c4.firebaseapp.com",
    databaseURL: "https://zamn-208c4-default-rtdb.firebaseio.com/",
    projectId: "zamn-208c4",
    storageBucket: "zamn-208c4.firebasestorage.app",
    appId: "1:383130846450:web:71a9fc2d45e5481b49fc6b"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Services
const auth = firebase.auth();
const db = firebase.database();
const storage = firebase.storage();

// Cloudinary
const CLOUD_NAME = 'dnmpmysk6';
const UPLOAD_PRESET = 'do_2gg';

// Admin Account
const ADMIN_EMAIL = 'jasim22v@gmail.com';
const ADMIN_PASSWORD = 'gg2314gg';

// Site Name
const SITE_NAME = 'ZAMN';

console.log('✅ ZAMN - Instagram Clone Ready');
