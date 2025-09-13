import { json } from '@sveltejs/kit';
import { getDb } from '$lib/database.js';

export async function POST({ request, locals }) {
  try {
    const user = locals.user;
    if (!user) return json({ success: false, message: '인증 필요' }, { status: 401 });

    const { token, deviceInfo } = await request.json();
    const db = getDb();

    const [existing] = await db.execute(
      'SELECT id FROM push_subscriptions WHERE user_id = ? AND device_token = ?',
      [user.id, token]
    );

    if (existing.length === 0) {
      await db.execute(
        'INSERT INTO push_subscriptions (user_id, device_token, device_info) VALUES (?, ?, ?)',
        [user.id, token, JSON.stringify(deviceInfo)]
      );
    }

    return json({ success: true, message: '구독 등록 완료' });
  } catch (error) {
    return json({ success: false, message: error.message }, { status: 500 });
  }
}