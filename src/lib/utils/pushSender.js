// src/lib/utils/pushSender.js
import admin from 'firebase-admin';

let firebaseInitialized = false;

function initializeFirebaseAdmin() {
  console.log('🔥 Firebase Admin 초기화 시도 시작');
  
  if (firebaseInitialized || admin.apps.length > 0) {
    console.log('🔥 이미 초기화됨');
    return true;
  }

  try {
    // 🔑 실제 Service Account Key (firebase-service-account.json에서 가져온 값들)
    const serviceAccount = {
      "type": "service_account",
      "project_id": "backoffice-31d48",
      "private_key_id": "d06b5840316da50b47f3adcffa2b8a5140e6f746",
      "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDJpiTsrTcymh2j\nC+U0DS/RRMIXXv8pOS/G943mwuxPeHcvOt3oGhhrotvj1I9bQl6UZmwt6Znz0UqF\nasv5sW5WVJdsPAsjxlojjz4y1WoEukTrQlb+pRHJiI4wr8JUwC8ZTbJATrHqgm7b\nO2zIWa0GJtD3HJRHcxGwJa8AGhgT+q1VlMPeeYb1Srwp5q7G+4fNGL0WDbc+4CJK\nBpTJvaAR+llkvhrGoJCvnQn8Pb9pbWTFmmrgyYcgJrfFoTWLiV0Wwm/F6rx9pt9v\ndMoBZntUHDd2yAmEA+Tq7MiDeAxoYqaqNOWtWOXe0Ct8UI+oT806/RyzF7TySrdZ\nrtOqHHbHAgMBAAECggEALKpZDnW1vsclXmqxm8x59YQh69RWd5abrxpBe8ZcWqQH\n3lXPNmylUR4zT61TDbdPRNbFCoxuVfPbal8EDGxRUN0O52ILY6K5b5v4foEIKUDr\nKCM7Ks98d6QAPueHh4dER3oOzDDCNvwqOvRYPa6jZTPu4HWboJHr7pUCROcCw1XD\nlRwOVYQHTu/x6liB5p4k7NxadLhunSGkSUy+jmDlWSUjJENi5DapHNyJI9An3i9S\npfeegLL7Wed5hI4stewzd7UNjA+Q3J9ozmiKtd+/wgltnrTlz0C4aXFoxcttA9KX\nledFQjud6xerXjXymZ34tgLDWZtQH8Q1aQkIsCqZjQKBgQD9O6kuidZDByQ6iC/A\nTxrudAPypFJV678ypm7H+USZk2l4CSEPr4Ctfs/ECIQ7fTYpjxAPIXgq/8v8QHWA\nHpoyJ1zvVJz5hTy2uWN8G5Aesb7KdZ5ZiuVBMfwo8MdhTJqPmBflhPPA0E9TtC9x\nInu8qLP2oZ1CRVCzp3t9s2FwLQKBgQDL2jF/qiTcKnnDqUXHxA0nQfBlKiBn4kSv\nE/RaBDcKJOaHaWmU09rCy2f8apR+/NniADFzl9wKnDDyjw+F6jKtRN1arw9Vrqsw\nkiOE7fxIqE4ASmIsHyGyQnqxjqXulbn5jvjs1qZWzTUwYfRvafIuATYEXrDUnqIn\nOf3oA6JnQwKBgQDLW17YXZ5vw0tnqbfXEm+JMCd/clAgaanoLdlmw5lATy3yVDp1\nkzWdnemQ/lnaQAn/w8Bctj7/IN4Z21XAplKjlhK+q09H3aRNBIGMx8GrtIeHpH6e\nX7kM6uwZoIosa8zvJW+DRIpOu7oIePlkPBHsBfpHQ6+66VkOfJ/h6OyFnQKBgE5j\n/7jqQvZvVxfI1k61s6EvGDSu+Hs6ZdM1xzd+e3PpMMVN4g4bUfqqobhNfAFBVsAz\n9tBOy41A9wmvvfZvU0GSQ9UFkM4QN0CcUhBiPCvsnOI7uHjjF+Am9GunQWP4K+Yt\n9seM27Zxf0y1vnvBsCHE0XLovvNkdVLEWEGKdD9lAoGAWR3t/MEN9TNumNzPFSV/\nFc8gcm6RB7KhW6XSehJDl3Dd+GFQhrvQFBp/+S1fjKMo85eiPHF2Jo8EETOyHYqM\n6Q6Pm3Hg8nEcLpF4wEglBn6I+Kqb8ikVB9q3icZYvhDelQl/E5HLCw+PVnOcSS/H\nbOs//pjwH0yGks6IFvvDQTk=\n-----END PRIVATE KEY-----\n",
      "client_email": "firebase-adminsdk-fbsvc@backoffice-31d48.iam.gserviceaccount.com",
      "client_id": "114330832503989334285",
      "auth_uri": "https://accounts.google.com/o/oauth2/auth",
      "token_uri": "https://oauth2.googleapis.com/token",
      "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
      "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40backoffice-31d48.iam.gserviceaccount.com",
      "universe_domain": "googleapis.com"
    };

    console.log('🔥 Firebase Admin 초기화 중...');
    console.log('🔥 Project ID:', serviceAccount.project_id);
    console.log('🔥 Client Email:', serviceAccount.client_email);

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

export async function sendPushToTokens(tokens, title, body, data = {}) {
  if (!initializeFirebaseAdmin()) {
    console.log('Firebase Admin이 초기화되지 않아 푸시 전송을 건너뜁니다.');
    return [];
  }

  if (!Array.isArray(tokens)) tokens = [tokens];
  
  const message = {
    data: { 
      title: title,  // 이 두 줄 추가!
      body: body,    // 이 두 줄 추가!
      ...data, 
      timestamp: Date.now().toString() 
    }
  };

  const results = [];
  const expiredTokens = []; // 만료된 토큰 수집

  for (const token of tokens) {
    try {
      await admin.messaging().send({ ...message, token });
      results.push({ token, success: true });
      console.log('✅ 푸시 전송 성공:', token.substring(0, 20) + '...');
    } catch (error) {
      console.error(`❌ 푸시 전송 실패: ${error.message}`);
      
      // 만료된 토큰 감지
      if (error.code === 'messaging/registration-token-not-registered') {
        expiredTokens.push(token);
      }
      
      results.push({ token, success: false, error: error.message });
    }
  }
  
  // 만료된 토큰들 DB에서 제거
  if (expiredTokens.length > 0) {
    try {
      const { getDb } = await import('$lib/database.js');
      const db = getDb();
      
      for (const expiredToken of expiredTokens) {
        await db.execute(
          'DELETE FROM push_subscriptions WHERE device_token = ?',
          [expiredToken]
        );
      }
      console.log(`🗑️ 만료된 토큰 ${expiredTokens.length}개 DB에서 제거됨`);
    } catch (dbError) {
      console.error('❌ 만료된 토큰 제거 실패:', dbError);
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

    console.log(`🔥 ${tokens.length}개 토큰으로 푸시 전송 시작`);
    const deviceTokens = tokens.map(t => t.device_token);
    return await sendPushToTokens(deviceTokens, title, body, data);
  } catch (error) {
    console.error('❌ 매출 푸시 전송 실패:', error);
    return [];
  }
}