const fs = require('fs');
const path = require('path');

// Firebase Service Account 개별 필드 로드
let firebaseProjectId = '';
let firebaseClientEmail = '';
let firebasePrivateKey = '';

try {
  const keyPath = path.join(__dirname, 'firebase-service-account.json');
  if (fs.existsSync(keyPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
    
    firebaseProjectId = serviceAccount.project_id;
    firebaseClientEmail = serviceAccount.client_email;
    firebasePrivateKey = serviceAccount.private_key;
    
    console.log('✅ Firebase Service Account 개별 필드 로드 완료');
  }
} catch (error) {
  console.error('❌ Firebase 키 파일 로드 실패:', error.message);
}

module.exports = {
  apps: [{
    name: 'admin-backoffice',
    script: 'build/index.js',
    instances: 1,
    exec_mode: 'fork',
    node_args: '--es-module-specifier-resolution=node', // 추가
    env: {
      NODE_ENV: 'production',
      PORT: 3001,
      HOST: '0.0.0.0',
      NODE_PATH: '/volume1/web/backoffice/node_modules',
      FIREBASE_PROJECT_ID: firebaseProjectId,
      FIREBASE_CLIENT_EMAIL: firebaseClientEmail,
      FIREBASE_PRIVATE_KEY: firebasePrivateKey
    }
  }]
};