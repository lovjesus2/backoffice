import { json } from '@sveltejs/kit';
import { getDb } from '$lib/database.js';

// GET - 사용자의 모든 노트 조회
export async function GET({ locals }) {
  if (!locals.user) {
    return json({ error: '로그인이 필요합니다' }, { status: 401 });
  }

  try {
    const db = getDb();
    const [notes] = await db.execute(
      'SELECT n.id, n.body, n.colors, n.position, n.width, n.height, n.user_id, u.username FROM notes n LEFT JOIN users u ON n.user_id = u.id ORDER BY n.id ASC',
      [locals.user.id]
    );

    // JSON 문자열을 객체로 파싱
    const parsedNotes = notes.map(note => ({
      ...note,
      colors: typeof note.colors === 'string' ? JSON.parse(note.colors) : note.colors,
      position: typeof note.position === 'string' ? JSON.parse(note.position) : note.position,
      width: note.width || 320,
      height: note.height || 250
    }));

    // 🎯 user 정보도 함께 반환
    return json({
      user: {
        id: locals.user.id,
        username: locals.user.username,
        role: locals.user.role
      },
      notes: parsedNotes
    });
  } catch (error) {
    console.error('노트 조회 실패:', error);
    return json({ error: '노트 조회 실패' }, { status: 500 });
  }
}

// POST - 새 노트 생성
export async function POST({ request, locals }) {
  if (!locals.user) {
    return json({ error: '로그인이 필요합니다' }, { status: 401 });
  }

  try {
    const { body = '', colors, position, width = 320, height = 250 } = await request.json();
    const db = getDb();

    const [result] = await db.execute(
      'INSERT INTO notes (user_id, body, colors, position, width, height) VALUES (?, ?, ?, ?, ?, ?)',
      [
        locals.user.id,
        body,
        JSON.stringify(colors),
        JSON.stringify(position),
        width,
        height
      ]
    );

    const [newNote] = await db.execute(
      'SELECT id, body, colors, position, width, height, user_id FROM notes WHERE id = ?',
      [result.insertId]
    );

    const note = newNote[0];
    return json({
      ...note,
      colors: typeof note.colors === 'string' ? JSON.parse(note.colors) : note.colors,
      position: typeof note.position === 'string' ? JSON.parse(note.position) : note.position,
      width: note.width || 320,
      height: note.height || 250
    });
  } catch (error) {
    console.error('노트 생성 실패:', error);
    return json({ error: '노트 생성 실패' }, { status: 500 });
  }
}

// PUT - 노트 업데이트
export async function PUT({ request, locals }) {
  if (!locals.user) {
    return json({ error: '로그인이 필요합니다' }, { status: 401 });
  }

  try {
    const { id, body, colors, position, width, height } = await request.json();
    const db = getDb();

    // 소유권 확인
    const [checkNote] = await db.execute(
      'SELECT user_id FROM notes WHERE id = ?',
      [id]
    );

    if (checkNote.length === 0) {
      return json({ error: '노트를 찾을 수 없습니다' }, { status: 404 });
    }

    await db.execute(
      'UPDATE notes SET body = ?, colors = ?, position = ?, width = ?, height = ? WHERE id = ?',
      [
        body,
        JSON.stringify(colors),
        JSON.stringify(position),
        width || 320,
        height || 250,
        id
      ]
    );

    return json({ success: true });
  } catch (error) {
    console.error('노트 업데이트 실패:', error);
    return json({ error: '노트 업데이트 실패' }, { status: 500 });
  }
}

// DELETE - 노트 삭제
export async function DELETE({ request, locals }) {
  if (!locals.user) {
    return json({ error: '로그인이 필요합니다' }, { status: 401 });
  }

  try {
    const { id } = await request.json();
    const db = getDb();

    // 소유권 확인
    const [checkNote] = await db.execute(
      'SELECT user_id FROM notes WHERE id = ?',
      [id]
    );

    if (checkNote.length === 0) {
      return json({ error: '노트를 찾을 수 없습니다' }, { status: 404 });
    }

    await db.execute('DELETE FROM notes WHERE id = ?', [id]);

    return json({ success: true });
  } catch (error) {
    console.error('노트 삭제 실패:', error);
    return json({ error: '노트 삭제 실패' }, { status: 500 });
  }
}