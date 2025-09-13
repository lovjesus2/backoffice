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
      "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQDELhm+7FedZeAg\nUzSVknO1JZfxo92ED4TKEwpi1mMS+IOcWrQjvrjd8EugJHOmRINlPgV6py8HADIH\nvNtwkISiuHD3TkYaLe44YGv96nK0HApqRkyMryo4NyUGu3C6c1IasTaPs6ffVkWo\nWU7TRTw6JtIwQUiu+nwhUXVoAdjbbE60LloVm85q95EhSxE0hi/4wgIizR0CXUms\nhlj/aYZyLIajUVkZTIg8jkeApQuKpIxJrgFriC2k9n0tiwdNaiDCF4pX8Z+w4vS0\ny/eQCPW3jIBbF9kCDa1SA590+NPq2O5EJ9ryIEr/rKacdqzN29f1H9Z4OCMEXfgE\nBGRv7BHdAgMBAAECggEAPHnlr+iVvczJAc4EmNNT3hTfuTsFr49FJTIncn6afh+k\nGtAPVjGWNby843o5OJlIVC6Ba+Ub5zGVOrNqhlHWwX7QPDyh+bINDM4UnGrov0Mh\nps9TC8932WqOfHvN7XxdZCMbKcN9Taj/wjz9wr1GKrsK8ps9d8t59p9w7QYcvs8j\nH51j5l9UBURNkHdpEAsf8MzXDLSHzUHpR8ULn/XIMpngUHf5KbP3Bgm3igMW6SKu\nZdj63UfScA1in6rwKDb6gMG5/N69bE7+d1KkirimTvqrhzhs4wS5ku9BGrT14cIq\nrk3N+6yshlzr4MAE1c/U6jZb2TpZca786yswhEXHdQKBgQDvYFAI9D5PdwOsNRm8\nkWaAD5/ha1nlaivKFBn75rIiB4Vmxu1XPR9wczyOafPtMQYg3C18maLI9XhiE2NY\nkY7cHXICcr4tt1WKFzbuoWwUjV9LSxsd2wRXXsJ8oKnbkLEiesKN5T1bGjumZfKp\n8pbKvTh2kKi2yLIALnkyEhjZJwKBgQDRzdYwIxXsRixY7pz+H7gZSXBJbEAu3doC\nI9rnYRpUFA4+yZHrnPt5qP9wvQvo9nHvspgkVjB2UCFHhwH8xmJ88gpfeoyiqFyO\n9zsYWTo4QogBBb/UvjlDmzp+6avuwDXOFkER4a5v4HS14wM2Nz4srk1AdZqdo26o\nA95zpMS3WwKBgQCDVKAUiYw2JOHK9UctgchusiPRlQg5Kcrkj6rB3YwVx3KVNMa6\nejppg4/RwqellqP6G1KJbfE1uBdYF7MFwLZUZYNLfJCCnHc90Aa/Xajijb2enZI/\nCw6SsNabcbo/UF8ev6NGHmNPPFFFteExBHtet/nmcu9deTbPiq/LnMotOQKBgQCy\nH7j+i3s8a2ORaZyeYJ2z0lbj72UapT5HXNuoYBezVIe3pPkfedtDskiVFdu7wSiA\nojdrekWQ3X0zthro2iGaBQDriSdHnftfYeWpSXAVfd7sR05Tt+D0ViE2yPsxK71C\nqEA8h0fLMlzEY+VBLWu7EY0C8hYASlZTjV1a/4QISwKBgQDNnOC25phygMVByZNX\nwJUHq5K/vrHwto6JzSM6mqp5Ua09WnxEDWuLbCM+1f4VVyZWGYShghHbhmZfALU5\nLrpwNSs5Ek0fXS6TZTTX1g4uWSXSlp1e59bp8kZLKmThO0B75TETNvGULT0y+AGf\ncaOckABlCpfl7yILOyWbAdhl5w==\n-----END PRIVATE KEY-----\n",
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
    notification: { title, body },
    data: { ...data, timestamp: Date.now().toString() }
  };

  const results = [];
  for (const token of tokens) {
    try {
      await admin.messaging().send({ ...message, token });
      results.push({ token, success: true });
      console.log('✅ 푸시 전송 성공:', token.substring(0, 20) + '...');
    } catch (error) {
      console.error(`❌ 푸시 전송 실패: ${error.message}`);
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

    console.log(`🔥 ${tokens.length}개 토큰으로 푸시 전송 시작`);
    const deviceTokens = tokens.map(t => t.device_token);
    return await sendPushToTokens(deviceTokens, title, body, data);
  } catch (error) {
    console.error('❌ 매출 푸시 전송 실패:', error);
    return [];
  }
}