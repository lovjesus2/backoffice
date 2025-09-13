import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: "AIzaSyCrZQO0K4I3rxXF1uHU0X3iJenAYARSz3w",
  authDomain: "backoffice-31d48.firebaseapp.com",
  projectId: "backoffice-31d48",
  storageBucket: "backoffice-31d48.firebasestorage.app",
  messagingSenderId: "550267566582",
  appId: "1:550267566582:web:df3990e8d73923976e6fd7"
};

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

export async function getFCMToken() {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;

    const token = await getToken(messaging, {
      vapidKey: 'BMIBO7eAzHVtz_rEIL0cimdhoAcBJ3Pv4YvSSXy1NAfg6i0mFaKgyKbq7TR6NJ4rYz51QIDDmruy0-UuudDIuQw'
    });
    
    return token;
  } catch (error) {
    console.error('FCM 토큰 가져오기 실패:', error);
    return null;
  }
}

export function setupForegroundMessaging() {
  onMessage(messaging, (payload) => {
    if (Notification.permission === 'granted') {
      const notification = new Notification(payload.notification.title, {
        body: payload.notification.body,
        icon: '/favicon.png'
      });
      setTimeout(() => notification.close(), 3000);
    }
  });
}