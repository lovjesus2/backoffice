import { json } from '@sveltejs/kit';
import { getDb } from '$lib/database.js';


// 안전한 값 변환 함수
function safeString(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  return String(value).trim();
}

function safeInteger(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = parseInt(value);
  return isNaN(parsed) ? null : parsed;
}

function safeBoolean(value) {
  if (value === null || value === undefined) return 0;
  return (value === true || value === 1 || value === '1') ? 1 : 0;
}

// 메뉴 목록 조회 (권한 정보 포함)
export async function GET({ locals }) {
  try {
    // 미들웨어에서 인증된 사용자 확인
    const user = locals.user;
    if (!user) {
      return json({ success: false, message: '인증이 필요합니다.' }, { status: 401 });
    }

    const db = getDb();
    const [rows] = await db.execute(`
      SELECT m.*, 
        GROUP_CONCAT(DISTINCT rmp.role) as allowed_roles
      FROM menus m
      LEFT JOIN role_menu_permissions rmp ON m.id = rmp.menu_id AND rmp.can_access = 1
      WHERE m.is_active = 1
      GROUP BY m.id
      ORDER BY COALESCE(m.parent_id, m.id), m.sort_order ASC
    `);

    // allowed_roles를 배열로 변환
    const menusWithRoles = rows.map(menu => ({
      ...menu,
      allowed_roles: menu.allowed_roles ? menu.allowed_roles.split(',') : []
    }));

    return json({
      success: true,
      data: menusWithRoles
    });

  } catch (error) {
    console.error('메뉴 조회 오류:', error);
    return json({ error: '메뉴 정보를 가져오는데 실패했습니다.' }, { status: 500 });
  }
}

// 새 메뉴 생성
export async function POST({ request, locals }) {
  try {
    // 미들웨어에서 인증된 사용자 확인
    const user = locals.user;
    if (!user) {
      return json({ success: false, message: '인증이 필요합니다.' }, { status: 401 });
    }

    const data = await request.json();
    console.log('메뉴 생성 요청 원본 데이터:', JSON.stringify(data, null, 2));

    // 안전한 값 변환
    const title = safeString(data.title);
    const icon = safeString(data.icon);
    const href = safeString(data.href);
    const parent_id = safeInteger(data.parent_id);
    const is_active = safeBoolean(data.is_active);
    const roles = Array.isArray(data.roles) ? data.roles : ['admin'];
    
    console.log('생성용 변환된 값들:', {
      title: `"${title}"`,
      icon: `"${icon}"`,
      href: `"${href}"`,
      parent_id,
      is_active,
      roles
    });
    
    if (!title) {
      return json({ error: '메뉴 제목은 필수입니다.' }, { status: 400 });
    }

    const db = getDb();
    
    // 새 순서 번호 계산
    let nextOrder = 1;
    if (parent_id) {
      // 하위 메뉴인 경우 해당 부모의 마지막 순서 + 1
      const [maxSubOrder] = await db.execute(
        'SELECT COALESCE(MAX(sort_order), 0) + 1 as next_order FROM menus WHERE parent_id = ?',
        [parent_id]
      );
      nextOrder = maxSubOrder[0].next_order;
    } else {
      // 최상위 메뉴인 경우
      const [maxOrder] = await db.execute(
        'SELECT COALESCE(MAX(sort_order), 0) + 1 as next_order FROM menus WHERE parent_id IS NULL'
      );
      nextOrder = maxOrder[0].next_order;
    }

    console.log('계산된 순서:', nextOrder);
    
    // 메뉴 생성 파라미터
    const createParams = [title, icon, href, parent_id, nextOrder, is_active];
    console.log('생성 SQL 파라미터:', createParams);
    
    const [result] = await db.execute(
      'INSERT INTO menus (title, icon, href, parent_id, sort_order, is_active) VALUES (?, ?, ?, ?, ?, ?)',
      createParams
    );

    const menuId = result.insertId;

    // 권한 설정
    for (const role of roles) {
      if (['admin', 'user'].includes(role)) {
        await db.execute(
          'INSERT INTO role_menu_permissions (role, menu_id, can_access) VALUES (?, ?, 1)',
          [role, menuId]
        );
      }
    }

    console.log('메뉴 생성 완료:', menuId);
    return json({ 
      success: true, 
      message: '메뉴가 생성되었습니다.',
      menuId: menuId 
    });

  } catch (error) {
    console.error('메뉴 생성 오류:', error);
    return json({ error: '메뉴 생성에 실패했습니다: ' + error.message }, { status: 500 });
  }
}

// 메뉴 순서 변경
export async function PUT({ request, locals }) {
  try {
    // 미들웨어에서 인증된 사용자 확인
    const user = locals.user;
    if (!user) {
      return json({ success: false, message: '인증이 필요합니다.' }, { status: 401 });
    }

    const { menuOrders } = await request.json();
    console.log('메뉴 순서 변경 요청:', menuOrders);
    
    if (!Array.isArray(menuOrders)) {
      return json({ error: '잘못된 데이터 형식입니다.' }, { status: 400 });
    }

    const db = getDb();
    
    await db.execute('START TRANSACTION');
    
    try {
      for (const orderItem of menuOrders) {
        const id = safeInteger(orderItem.id);
        const sort_order = safeInteger(orderItem.sort_order);
        
        if (id && sort_order !== null) {
          await db.execute(
            'UPDATE menus SET sort_order = ? WHERE id = ?',
            [sort_order, id]
          );
        }
      }
      
      await db.execute('COMMIT');
      console.log('메뉴 순서 변경 완료');
      return json({ success: true, message: '메뉴 순서가 변경되었습니다.' });
      
    } catch (error) {
      await db.execute('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('메뉴 순서 변경 오류:', error);
    return json({ error: '메뉴 순서 변경에 실패했습니다: ' + error.message }, { status: 500 });
  }
}
