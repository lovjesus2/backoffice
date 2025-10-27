// src/lib/middleware/auth.js - 수정된 버전
import jwt from 'jsonwebtoken';
import { getDb } from '$lib/database.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// JWT 토큰 검증
export function verifyToken(cookies) {
  try {
    const token = cookies.get('token');
    console.log('🔍 토큰 확인:', token ? '토큰 있음' : '토큰 없음');
    
    if (!token) {
      throw new Error('인증 토큰이 없습니다. 다시 로그인해주세요.');
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('🔍 디코딩된 토큰 전체:', JSON.stringify(decoded)); // 완전한 객체 출력
    console.log('🔍 decoded.username:', decoded.username);
    console.log('🔍 decoded.role:', decoded.role);
    
    return { success: true, user: decoded };
    
  } catch (error) {
    console.log('❌ 토큰 검증 에러:', error.message);
    if (error.name === 'TokenExpiredError') {
      return { success: false, error: '토큰이 만료되었습니다.' };
    }
    return { success: false, error: '유효하지 않은 토큰입니다.' };
  }
}

// 사용자 역할 권한 체크
export function checkRolePermission(user, requiredRoles) {
  if (!user) return false;
  
  if (Array.isArray(requiredRoles)) {
    return requiredRoles.includes(user.role);
  }
  
  return user.role === requiredRoles;
}

// DB에서 페이지 권한 확인
async function checkPagePermission(pathname, userRole) {
  try {
    const db = getDb();
    const [rows] = await db.execute(`
      SELECT rmp.can_access 
      FROM menus m 
      JOIN role_menu_permissions rmp ON m.id = rmp.menu_id 
      WHERE m.href = ? AND rmp.role = ? AND rmp.can_access = 1
    `, [pathname, userRole]);
    
    console.log(`🔍 페이지 권한 체크: ${pathname} (${userRole}) -> ${rows.length > 0 ? '허용' : '차단'}`);
    return rows.length > 0;
  } catch (error) {
    console.error('페이지 권한 체크 오류:', error);
    return false;
  }
}

// API 경로별 권한 레벨 정의
export function getApiPermissionLevel(url) {
  const pathname = url.pathname;
  const searchParams = url.searchParams;
  
  console.log('🔍 API 경로 권한 체크:', pathname);
  
  // ✅ 1단계:구체적인 경로 체크 (정확한 매칭) 우선순위
  const publicPaths = [
    '/api/auth/login',
  ];
  
  const authenticatedPaths = [
    '/api/auth/me',
    '/api/auth/logout',
    '/api/profile',
    '/api/profile/password',
    '/api/user-menus',
    '/api/notes',
    '/api/system/info',
    '/api/system',  // ← 이거 추가
    '/api/push/subscribe'  // ✅ 이거 추가!
  ];
  
  const adminOnlyPaths = [
    '/api/users',
    '/api/menus',
    '/api/settings',
    '/api/admin'
  ];
  
   // 특별 처리 (구체적인 경로)
  if (pathname === '/api/system' && searchParams.get('mode') === 'info') {
    console.log('📋 시스템 정보 모드 (AUTHENTICATED)');
    return 'AUTHENTICATED';
  }
  
  // 로그인 상관없이
  if (publicPaths.includes(pathname)) {
    console.log('🌍 PUBLIC API');
    return 'PUBLIC';
  }
  
  // 모든사용자
  if (authenticatedPaths.includes(pathname)) {
    console.log('🔐 AUTHENTICATED API');
    return 'AUTHENTICATED';
  }
  
  // 관라자
  if (adminOnlyPaths.includes(pathname)) {
    console.log('👑 ADMIN_ONLY API');
    return 'ADMIN_ONLY';
  }
  //----------------------------------------------------------------------------
  // ✅ 2단계: 패턴 매칭 (중간 우선순위)
  
  
  // AUTHENTICATED 패턴들
  if (pathname.startsWith('/api/common-codes') ||
      pathname.startsWith('/api/product-management/product-stock') ||
      pathname.startsWith('/api/sales/sales-registration')) {
    console.log('🔐 AUTHENTICATED API (패턴)');
    return 'AUTHENTICATED';
  }
    
  // ADMIN_ONLY 패턴들
  if (pathname.startsWith('/api/users/') || 
      pathname.startsWith('/api/menus/') ||
      pathname.startsWith('/api/settings/') ||
      pathname.startsWith('/api/system/')) {
    console.log('👑 ADMIN_ONLY API (패턴)');
    return 'ADMIN_ONLY';
  }
  
  // ✅ 3단계: 기본값 (최저 우선순위)
  console.log('👑 ADMIN_ONLY API (기본값)');
  return 'ADMIN_ONLY';
}
// API 권한 체크 함수
export async function checkApiPermission(url, cookies) {
  const permissionLevel = getApiPermissionLevel(url);
  
  console.log(`🔒 API 권한 체크: ${url.pathname}${url.search} (레벨: ${permissionLevel})`);
  
  if (permissionLevel === 'PUBLIC') {
    console.log('✅ PUBLIC API 접근 허용');
    return { allowed: true };
  }
  
  const tokenResult = verifyToken(cookies);
  
  if (!tokenResult.success) {
    console.log('❌ 토큰 검증 실패:', tokenResult.error);
    return { 
      allowed: false, 
      error: tokenResult.error, 
      status: 401 
    };
  }
  
  const user = tokenResult.user;
  console.log('✅ 토큰 검증 성공:', user.username, user.role);
  
  if (permissionLevel === 'AUTHENTICATED') {
    console.log('✅ AUTHENTICATED API 접근 허용');
    return { allowed: true, user };
  }
  
  if (permissionLevel === 'ADMIN_ONLY') {
    if (user.role !== 'admin') {
      console.log('❌ 관리자 권한 필요:', user.role);
      return { 
        allowed: false, 
        error: '관리자 권한이 필요합니다.', 
        status: 403 
      };
    }
    
    console.log('✅ ADMIN_ONLY API 접근 허용');
    return { allowed: true, user };
  }
  
  if (permissionLevel === 'MENU_BASED') {
    console.log('📄 메뉴 기반 권한 체크 시작');
    
    const apiToPageMapping = {
      '/api/sales': '/admin/sales/sales-registration',
      '/api/inventory': '/admin/inventory',
      '/api/reports': '/admin/reports',
      '/api/orders': '/admin/orders',
      '/api/customers': '/admin/customers',
      '/api/suppliers': '/admin/suppliers'
    };
    
    let pagePath = null;
    for (const [apiPath, pagePathValue] of Object.entries(apiToPageMapping)) {
      if (url.pathname.startsWith(apiPath)) {
        pagePath = pagePathValue;
        break;
      }
    }
    
    if (!pagePath) {
      console.log('❌ 매핑되지 않은 API 경로:', url.pathname);
      if (user.role !== 'admin') {
        return { 
          allowed: false, 
          error: '접근 권한이 없습니다.', 
          status: 403 
        };
      }
      return { allowed: true, user };
    }
    
    const hasPermission = await checkPagePermission(pagePath, user.role);
    
    if (!hasPermission) {
      console.log('❌ 메뉴 기반 권한 없음:', pagePath, user.role);
      return { 
        allowed: false, 
        error: '해당 기능에 접근할 권한이 없습니다.', 
        status: 403 
      };
    }
    
    console.log('✅ MENU_BASED API 접근 허용:', pagePath);
    return { allowed: true, user };
  }
  
  console.log('❌ 알 수 없는 권한 레벨:', permissionLevel);
  return { 
    allowed: false, 
    error: '접근 권한을 확인할 수 없습니다.', 
    status: 500 
  };
}

// 🔥 수정된 미들웨어 핸들러
export function createAuthHandle() {
  return async ({ event, resolve }) => {
    const { url, cookies } = event;
    
    console.log(`🌐 요청: ${url.pathname}`);
    
    // API 권한 체크
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/proxy-images/')) {
      let permissionCheck;
      
      if (url.pathname.startsWith('/proxy-images/')) {
        console.log('🖼️ 이미지 프록시 권한 체크');
        const tokenResult = verifyToken(cookies);
        
        if (!tokenResult.success) {
          console.log('❌ 이미지 접근 거부:', tokenResult.error);
          permissionCheck = {
            allowed: false,
            error: tokenResult.error,
            status: 401
          };
        } else {
          console.log('✅ 이미지 접근 허용:', tokenResult.user.username);
          permissionCheck = {
            allowed: true,
            user: tokenResult.user
          };
        }
      } else {
        permissionCheck = await checkApiPermission(url, cookies);
      }
      
      if (!permissionCheck.allowed) {
        console.log(`🚫 API 접근 차단: ${url.pathname} - ${permissionCheck.error}`);
        return new Response(
          JSON.stringify({ 
            error: permissionCheck.error,
            authenticated: false 
          }),
          { 
            status: permissionCheck.status || 401,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
      
      if (permissionCheck.user) {
        event.locals.user = permissionCheck.user;
        console.log('✅ API 사용자 정보 locals에 저장:', permissionCheck.user.username);
      }
      
      console.log(`✅ API 접근 허용: ${url.pathname} (사용자: ${permissionCheck.user?.username || 'anonymous'})`);
    }
    
    // 🔥 페이지 권한 체크 (수정된 부분)
    if (url.pathname === '/admin' || url.pathname.startsWith('/admin/')) {
      console.log('📄 페이지 접근 권한 체크:', url.pathname);
      
      const tokenResult = verifyToken(cookies);
      
      if (!tokenResult.success) {
        console.log('❌ 페이지 접근 - 로그인 필요:', tokenResult.error);
        return new Response(null, {
          status: 302,
          headers: { 'Location': `/?redirectTo=${url.pathname}` }
        });
      }

      // 🔥 중요: 먼저 locals에 사용자 정보 저장
      event.locals.user = tokenResult.user;
      
      // /admin (대시보드)은 로그인만 하면 접근 가능
      if (url.pathname === '/admin') {
        console.log('🔍 [페이지] tokenResult 전체:', tokenResult);
        console.log('🔍 [페이지] tokenResult.success:', tokenResult.success);
        console.log('🔍 [페이지] tokenResult.user:', tokenResult.user);
        console.log('🔍 [페이지] tokenResult.user?.username:', tokenResult.user?.username);
        
        event.locals.user = tokenResult.user;
        console.log('✅ 대시보드 접근 허용:', tokenResult.user?.username, tokenResult.user?.role);
        return resolve(event);
      }
      
      // 다른 페이지들은 DB에서 권한 확인
      const hasPermission = await checkPagePermission(url.pathname, tokenResult.user.role);
      
      if (!hasPermission) {
        console.log('❌ 페이지 접근 권한 없음:', url.pathname, tokenResult.user.role);
        return new Response(null, {
          status: 302,
          headers: { 'Location': '/admin?error=access_denied' }
        });
      }
      
      console.log('✅ 페이지 접근 허용:', url.pathname, tokenResult.user.username);
    }
    
    return resolve(event);
  };
}