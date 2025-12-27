import { createAuthHandle } from '$lib/middleware/auth.js';
import { getDb } from '$lib/database.js';

console.log('🔧 hooks.server.js 로드됨');

export const handle = async ({ event, resolve }) => {
  const authHandle = createAuthHandle();
  
  let printerServerUrl = 'https://*.local:8443';
  
  try {
    const db = getDb();
    const [rows] = await db.query(
      'SELECT setting_value FROM system_settings WHERE setting_key = ?',
      ['output_computer_name']
    );
    
    if (rows && rows.length > 0) {
      const value = rows[0].setting_value?.trim();
      
      if (value) {
        if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(value)) {
          printerServerUrl = `https://${value}:8443`;
        } else {
          if (!value.endsWith('.local')) {
            printerServerUrl = `https://${value}.local:8443`;
          } else {
            printerServerUrl = `https://${value}:8443`;
          }
        }
      }
    }
  } catch (error) {
    console.error('프린터 서버 설정 로드 실패:', error);
  }
  
  const response = await authHandle({ event, resolve });
  
  response.headers.set(
    'Content-Security-Policy',
    `
      default-src 'self';
      script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com https://cdnjs.cloudflare.com https://www.gstatic.com blob:;
      worker-src 'self' blob: data:;
      style-src 'self' 'unsafe-inline' https://unpkg.com https://cdnjs.cloudflare.com;
      img-src 'self' data: blob: https: http:;
      font-src 'self' 'unsafe-inline' data: https://unpkg.com https://cdnjs.cloudflare.com;
      connect-src 'self' 
                https://localhost:8443 
                wss://localhost:8443 
                https://*.local:8443
                ${printerServerUrl}
                https://unpkg.com 
                https://cdnjs.cloudflare.com
                https://firebaseinstallations.googleapis.com
                https://fcmregistrations.googleapis.com
                https://fcm.googleapis.com
                https://firebase.googleapis.com;
      frame-src 'self';
      object-src 'none';
      base-uri 'self';
      form-action 'self';
    `.replace(/\s+/g, ' ').trim()
  );
  
  return response;
};