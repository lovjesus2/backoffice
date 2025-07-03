import { json } from '@sveltejs/kit';
import jwt from 'jsonwebtoken';
import { getDb } from '$lib/database.js';

const JWT_SECRET = 'your-secret-key';

// 메뉴 상세 조회
export async function GET({ params, cookies }) {
  try {
    const token = cookies.get('token');
    if (!token) {
      return json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin') {
      return json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const db = getDb();
    const [rows] = await db.execute(
      'SELECT * FROM menus WHERE id = ?',
      [params.id]
    );

    if (rows.length === 0) {
      return json({ error: '메뉴를 찾을 수 없습니다.' }, { status: 404 });
    }

    return json({ success: true, menu: rows[0] });

  } catch (error) {
    console.error('메뉴 조회 오류:', error);
    return json({ error: '메뉴 정보를 가져오는데 실패했습니다.' }, { status: 500 });
  }
}

// 메뉴 수정
export async function PUT({ params, request, cookies }) {
  try {
    const token = cookies.get('token');
    if (!token) {
      return json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin') {
      return json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const data = await request.json();
    console.log('💡 메뉴 수정 요청:', data);

    // 매우 간단하고 확실한 방법으로 처리
    let title = '';
    let icon = '';
    let href = '';
    let parent_id = null;
    let is_active = 1;

    // 하나씩 안전하게 설정
    if (data.title && typeof data.title === 'string') {
      title = data.title.trim();
    }
    
    if (data.icon && typeof data.icon === 'string') {
      icon = data.icon;
    }
    
    if (data.href && typeof data.href === 'string') {
      href = data.href;
    }
    
    if (data.parent_id && !isNaN(parseInt(data.parent_id))) {
      parent_id = parseInt(data.parent_id);
    }
    
    if (data.is_active === false || data.is_active === 0) {
      is_active = 0;
    }

    console.log('💡 정리된 값들:', { title, icon, href, parent_id, is_active });

    if (!title) {
      return json({ error: '메뉴 제목은 필수입니다.' }, { status: 400 });
    }

    const db = getDb();
    
    // 메뉴 존재 확인
    const [existing] = await db.execute(
      'SELECT * FROM menus WHERE id = ?',
      [params.id]
    );
    
    if (existing.length === 0) {
      return json({ error: '메뉴를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 메뉴 정보 업데이트 - 각 값을 개별적으로 전달
    await db.execute(
      'UPDATE menus SET title = ?, icon = ?, href = ?, parent_id = ?, is_active = ? WHERE id = ?',
      [title, icon, href, parent_id, is_active, params.id]
    );

    // 권한 정보 업데이트
    if (data.roles && Array.isArray(data.roles)) {
      // 기존 권한 삭제
      await db.execute(
        'DELETE FROM role_menu_permissions WHERE menu_id = ?',
        [params.id]
      );
      
      // 새 권한 추가
      for (const role of data.roles) {
        if (role === 'admin' || role === 'user') {
          await db.execute(
            'INSERT INTO role_menu_permissions (role, menu_id, can_access) VALUES (?, ?, 1)',
            [role, params.id]
          );
        }
      }
    }

    console.log('✅ 메뉴 수정 완료:', params.id);
    return json({ success: true, message: '메뉴가 수정되었습니다.' });

  } catch (error) {
    console.error('❌ 메뉴 수정 오류:', error);
    return json({ error: '메뉴 수정에 실패했습니다.' }, { status: 500 });
  }
}

// 메뉴 삭제
export async function DELETE({ params, cookies }) {
  try {
    const token = cookies.get('token');
    if (!token) {
      return json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin') {
      return json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const db = getDb();
    
    // 하위 메뉴가 있는지 확인
    const [children] = await db.execute(
      'SELECT COUNT(*) as count FROM menus WHERE parent_id = ?',
      [params.id]
    );
    
    if (children[0].count > 0) {
      return json({ error: '하위 메뉴가 있는 메뉴는 삭제할 수 없습니다.' }, { status: 400 });
    }
    
    // 권한 정보 먼저 삭제
    await db.execute(
      'DELETE FROM role_menu_permissions WHERE menu_id = ?',
      [params.id]
    );
    
    // 메뉴 삭제
    const [result] = await db.execute(
      'DELETE FROM menus WHERE id = ?',
      [params.id]
    );

    if (result.affectedRows === 0) {
      return json({ error: '메뉴를 찾을 수 없습니다.' }, { status: 404 });
    }

    console.log('✅ 메뉴 삭제 완료:', params.id);
    return json({ success: true, message: '메뉴가 삭제되었습니다.' });

  } catch (error) {
    console.error('❌ 메뉴 삭제 오류:', error);
    return json({ error: '메뉴 삭제에 실패했습니다.' }, { status: 500 });
  }
}
