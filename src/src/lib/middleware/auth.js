import jwt from 'jsonwebtoken';
import { isMaintenanceMode } from '$lib/utils/systemSettings.js';

const JWT_SECRET = 'your-secret-key';

// JWT 토큰 검증
export function verifyToken(cookies) {
  try {
    const token = cookies.get('token');
    if (!token) {
      throw new Error('인증 토큰이 없습니다. 다시 로그인해주세요.');
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    return { success: true, user: decoded };
  } catch (error) {
    return { success: false, error: error.message };
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

// API 경로별 권한 레벨 정의
export function getApiPermissionLevel(url) {
  const pathname = url.pathname;
  const searchParams = url.searchParams;
  
  // PUBLIC: 인증 불필요
  const publicPaths = [
    '/api/auth/login'
  ];
  
  // AUTHENTICATED: 로그인 필요
  const authenticatedPaths = [
    '/api/auth/me',
    '/api/auth/logout',
    '/api/profile',
    '/api/user-menus',
    '/api/system/info'
  ];
  
  // ADMIN_ONLY: 관리자 전용
  const adminOnlyPaths = [
    '/api/users',
    '/api/menus'
  ];
  
  console.log('🔍 API 경로 권한 체크:', pathname);
  
  // 🔧 특별 처리: /api/system?mode=info는 AUTHENTICATED
  if (pathname === '/api/system' && searchParams.get('mode') === 'info') {
    console.log('📋 시스템 정보 모드 (AUTHENTICATED)');
    return 'AUTHENTICATED';
  }
  
  // 정확히 일치하는 경로 먼저 체크
  if (publicPaths.includes(pathname)) {
    console.log('🌍 PUBLIC API');
    return 'PUBLIC';
  }
  
  if (authenticatedPaths.includes(pathname)) {
    console.log('🔐 AUTHENTICATED API');
    return 'AUTHENTICATED';
  }
  
  if (adminOnlyPaths.includes(pathname)) {
    console.log('👑 ADMIN_ONLY API');
    return 'ADMIN_ONLY';
  }
  
  // 패턴 매칭 체크
  if (pathname.startsWith('/api/users/') || 
      pathname.startsWith('/api/menus/') ||
      pathname === '/api/system') {
    console.log('👑 ADMIN_ONLY API (패턴)');
    return 'ADMIN_ONLY';
  }
  
  if (pathname.startsWith('/api/profile/')) {
    console.log('🔐 AUTHENTICATED API (패턴)');
    return 'AUTHENTICATED';
  }
  
  // 기본값: AUTHENTICATED (보안 강화)
  console.log('🔐 AUTHENTICATED API (기본값)');
  return 'AUTHENTICATED';
}

// API 권한 체크
export async function checkApiPermission(url, cookies) {
  const permissionLevel = getApiPermissionLevel(url);
  
  console.log(`🔒 API 권한 체크: ${url.pathname}${url.search} (레벨: ${permissionLevel})`);
  
  // PUBLIC API는 바로 통과
  if (permissionLevel === 'PUBLIC') {
    console.log('✅ PUBLIC API 접근 허용');
    return { allowed: true };
  }
  
  // 토큰 검증
  console.log('🔍 토큰 검증 시도:', cookies.get('token') ? '토큰 있음' : '토큰 없음');
  const tokenResult = verifyToken(cookies);
  
  if (!tokenResult.success) {
    console.log('❌ 토큰 검증 실패:', tokenResult.error);
    console.log(`❌ API 접근 거부: ${url.pathname}${url.search} ${tokenResult.error}`);
    return { 
      allowed: false, 
      error: tokenResult.error,
      status: 401 
    };
  }
  
  const user = tokenResult.user;
  console.log('✅ 토큰 검증 성공:', user.username, user.role);
  
  // AUTHENTICATED: 로그인만 하면 접근 가능
  if (permissionLevel === 'AUTHENTICATED') {
    console.log('✅ AUTHENTICATED API 접근 허용');
    return { allowed: true, user };
  }
  
  // ADMIN_ONLY: 관리자만 접근 가능
  if (permissionLevel === 'ADMIN_ONLY') {
    if (user.role !== 'admin') {
      console.log('❌ 관리자 권한 필요:', user.role);
      console.log(`❌ API 접근 거부: ${url.pathname}${url.search} 관리자 권한이 필요합니다.`);
      return { 
        allowed: false, 
        error: '관리자 권한이 필요합니다.',
        status: 403 
      };
    }
    
    console.log('✅ 관리자 권한 확인됨');
    return { allowed: true, user };
  }
  
  console.log('✅ 권한 체크 통과');
  return { allowed: true, user };
}

// SvelteKit hooks에서 사용할 핸들러 생성
export function createAuthHandle() {
  return async ({ event, resolve }) => {
    const { url, cookies } = event;
    
    // 🚧 점검 모드 확인 (관리자 제외)
    if (!url.pathname.startsWith('/api/auth/login')) {
      const maintenanceMode = await isMaintenanceMode();
      if (maintenanceMode) {
        // 관리자인지 확인
        const tokenResult = verifyToken(cookies);
        const isAdmin = tokenResult.success && tokenResult.user.role === 'admin';
        
        if (!isAdmin) {
          // 점검 페이지 반환
          if (url.pathname.startsWith('/api/')) {
            return new Response(
              JSON.stringify({ 
                error: '시스템 점검 중입니다. 잠시 후 다시 이용해주세요.',
                maintenance: true
              }),
              { 
                status: 503,
                headers: { 'Content-Type': 'application/json' }
              }
            );
          } else {
            // 점검 페이지 HTML 반환
            return new Response(`
              <!DOCTYPE html>
              <html lang="ko">
              <head>
                <meta charset="utf-8">
                <title>시스템 점검 중</title>
                <style>
                  body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f8f9fa; }
                  .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                  h1 { color: #dc3545; margin-bottom: 20px; }
                  p { color: #6c757d; line-height: 1.6; }
                  .icon { font-size: 4rem; margin-bottom: 20px; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="icon">🔧</div>
                  <h1>시스템 점검 중</h1>
                  <p>현재 시스템 점검으로 인해 서비스를 일시적으로 중단합니다.</p>
                  <p>빠른 시간 내에 정상 서비스로 복구하겠습니다.</p>
                  <p>이용에 불편을 드려 죄송합니다.</p>
                </div>
              </body>
              </html>
            `, {
              status: 503,
              headers: { 'Content-Type': 'text/html; charset=utf-8' }
            });
          }
        }
      }
    }
    
    // API 요청인 경우에만 권한 체크
    if (url.pathname.startsWith('/api/')) {
      const permissionResult = await checkApiPermission(url, cookies);
      
      if (!permissionResult.allowed) {
        return new Response(
          JSON.stringify({ 
            error: permissionResult.error || '접근이 거부되었습니다.' 
          }),
          { 
            status: permissionResult.status || 403,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
      
      // 사용자 정보를 event.locals에 저장
      if (permissionResult.user) {
        event.locals.user = permissionResult.user;
        console.log('✅ 사용자 정보 locals에 저장:', permissionResult.user.username);
      }
    }
    
    console.log('✅ 권한 체크 통과');
    return resolve(event);
  };
}
