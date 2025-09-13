// src/lib/utils/pushSender.js
import admin from 'firebase-admin';

// 조건부 초기화로 변경
let firebaseInitialized = false;

function initializeFirebaseAdmin() {
  console.log('🔥 Firebase 초기화 시도 시작');
  console.log('🔥 환경변수 존재 여부:', !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  console.log('🔥 환경변수 길이:', process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.length || 0);
  
  if (firebaseInitialized || admin.apps.length > 0) {
    console.log('🔥 이미 초기화됨');
    return true;
  }

  try {
    if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      console.warn('❌ FIREBASE_SERVICE_ACCOUNT_KEY 환경변수가 없습니다.');
      return false;
    }

    console.log('🔥 JSON 파싱 시도...');
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    console.log('🔥 파싱 성공, project_id:', serviceAccount.project_id);
    
    if (!serviceAccount.project_id) {
      console.error('❌ Service Account에 project_id가 없습니다.');
      return false;
    }

    console.log('🔥 Firebase Admin 초기화 중...');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id
    });

    firebaseInitialized = true;
    console.log('✅ Firebase Admin 초기화 완료');
    return true;
  } catch (error) {
    console.error('❌ Firebase Admin 초기화 실패:', error.message);
    console.error('❌ 상세 오류:', error);
    return false;
  }
}

// ❌ 이 부분 완전 삭제!
// if (!admin.apps.length) {
//   admin.initializeApp({ ... });
// }

export async function sendPushToTokens(tokens, title, body, data = {}) {
  if (!initializeFirebaseAdmin()) {
    console.log('Firebase Admin이 초기화되지 않아 푸시 전송을 건너뜁니다.');
    return [];
  }

  if (!Array.isArray(tokens)) tokens = [tokens];
  
  const message = {
    notification: { title, body },
    data: { ...data, timestamp: Date.now().toString() }
  };

  const results = [];
  for (const token of tokens) {
    try {
      await admin.messaging().send({ ...message, token });
      results.push({ token, success: true });
    } catch (error) {
      console.error(`푸시 전송 실패: ${error.message}`);
      results.push({ token, success: false, error: error.message });
    }
  }
  return results;
}

export async function sendSaleNotification(title, body, data = {}) {
  if (!initializeFirebaseAdmin()) {
    console.log('Firebase Admin이 초기화되지 않아 푸시 전송을 건너뜁니다.');
    return [];
  }

  try {
    const { getDb } = await import('$lib/database.js');
    const db = getDb();
    
    const [tokens] = await db.execute(
      'SELECT device_token FROM push_subscriptions WHERE device_token IS NOT NULL'
    );

    if (tokens.length === 0) {
      console.log('등록된 푸시 토큰이 없습니다.');
      return [];
    }

    const deviceTokens = tokens.map(t => t.device_token);
    return await sendPushToTokens(deviceTokens, title, body, data);
  } catch (error) {
    console.error('매출 푸시 전송 실패:', error);
    return [];
  }
}