import { json } from '@sveltejs/kit';
import { getDb } from '$lib/database.js';


export async function GET({ url, locals }) {
  try {
    // 미들웨어에서 인증된 사용자 확인
    const user = locals.user;
    if (!user) {
      return json({ success: false, message: '인증이 필요합니다.' }, { status: 401 });
    }

    const role = url.searchParams.get('role') || user.role;
    
    console.log('사용자 메뉴 API 호출, role:', role);
    
    if (!role || !['admin', 'user'].includes(role)) {
      return json({
        success: false,
        message: '유효하지 않은 역할입니다.'
      }, { status: 400 });
    }
    
    const db = getDb();
    
    // 역할별 접근 가능한 모든 메뉴 조회 (부모-자식 관계 포함)
    const [rows] = await db.execute(`
      SELECT DISTINCT m.*
      FROM menus m
      LEFT JOIN role_menu_permissions rmp ON m.id = rmp.menu_id
      WHERE m.is_active = 1 
      AND (
        (rmp.role = ? AND rmp.can_access = 1) 
        OR ? = 'admin'
      )
      ORDER BY COALESCE(m.parent_id, m.id), m.sort_order ASC
    `, [role, role]);

    console.log('조회된 메뉴:', rows.length, '개');
    rows.forEach(menu => {
      console.log(`- ${menu.id}: ${menu.title} (parent: ${menu.parent_id})`);
    });
    
    return json({
      success: true,
      data: rows,
      role: role,
      message: `${role} 역할에 대한 ${rows.length}개 메뉴 반환`
    });
    
  } catch (error) {
    console.error('사용자 메뉴 API 오류:', error);
    return json({
      success: false,
      message: '메뉴 정보를 가져오는데 실패했습니다.',
      error: error.message
    }, { status: 500 });
  }
}
