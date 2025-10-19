// src/lib/middleware/auth.js
import jwt from 'jsonwebtoken';
import { isMaintenanceMode } from '$lib/utils/systemSettings.js';

const JWT_SECRET = 'your-secret-key';

// JWT 토큰 검증
export function verifyToken(cookies) {
    try {
        // 쿠키에서 토큰 조회
        let token = cookies.get('token');
        
        // 쿠키에 없으면 헤더에서 조회 (Authorization Bearer)
        if (!token && typeof window !== 'undefined') {
            const authHeader = document.cookie
                .split('; ')
                .find(row => row.startsWith('token='));
            if (authHeader) {
                token = authHeader.split('=')[1];
            }
        }

        if (!token) {
            return { success: false, error: '토큰이 없습니다.' };
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        return { success: true, user: decoded };
        
    } catch (error) {
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

// API 경로별 권한 레벨 정의
export function getApiPermissionLevel(url) {
  const pathname = url.pathname;
  const searchParams = url.searchParams;
  
  console.log('🔍 API 경로 권한 체크:', pathname);
  
  // PUBLIC: 인증 불필요
  const publicPaths = [
    '/api/auth/login'
  ];
  
  // AUTHENTICATED: 로그인 필요
  const authenticatedPaths = [
    '/api/auth/me',
    '/api/auth/logout',
    '/api/profile',
    '/api/profile/password',
    '/api/user-menus',
    '/api/system/info'
  ];
  
  // ADMIN_ONLY: 관리자 전용
  const adminOnlyPaths = [
    '/api/users',
    '/api/menus',
    '/api/settings',
    '/api/system'
  ];
  
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
  
  // 패턴 매칭 체크 (동적 경로들)
  if (pathname.startsWith('/api/users/') || 
      pathname.startsWith('/api/menus/') ||
      pathname.startsWith('/api/sales/calendar') ||
      pathname.startsWith('/api/sales/sale01') ||
      pathname.startsWith('/api/product-management/')
    ) {
    console.log('👑 ADMIN_ONLY API (패턴)');
    return 'ADMIN_ONLY';
  }
  
  if (pathname.startsWith('/api/profile/')) {
    console.log('🔐 AUTHENTICATED API (패턴)');
    return 'AUTHENTICATED';
  }
  
  if (pathname === '/api/system') {
    console.log('👑 ADMIN_ONLY API (시스템)');
    return 'ADMIN_ONLY';
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
    
    console.log(`🌐 요청: ${event.request.method} ${url.pathname}${url.search}`);
    
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
            // 페이지 요청인 경우 점검 페이지로 리다이렉트
            return new Response(null, {
              status: 302,
              headers: { 'Location': '/maintenance' }
            });
          }
        }
      }
    }
    
    // 🆕 API와 이미지 프록시 요청 모두 처리
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/proxy-images/')) {
      let permissionCheck;
      
      if (url.pathname.startsWith('/proxy-images/')) {
        // 🖼️ 이미지 프록시는 로그인만 필요
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
        // 🔧 일반 API 권한 체크
        permissionCheck = await checkApiPermission(url, cookies);
      }
      
      if (!permissionCheck.allowed) {
        console.log(`🚫 접근 차단: ${url.pathname} - ${permissionCheck.error}`);
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
      
      // 인증된 사용자 정보를 locals에 저장
      if (permissionCheck.user) {
        event.locals.user = permissionCheck.user;
        console.log('✅ 사용자 정보 locals에 저장:', permissionCheck.user.username);
      }
      
      console.log(`✅ 접근 허용: ${url.pathname} (사용자: ${permissionCheck.user?.username || 'anonymous'})`);
    }
    
    return resolve(event);
  };
}