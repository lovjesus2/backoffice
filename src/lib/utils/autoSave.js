import { browser } from '$app/environment';

// 시스템 설정 캐시 (매번 DB 조회 방지)
let settingsCache = null;
let settingsCacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5분

// DB에서 자동저장 시스템 설정 조회
async function getAutoSaveSettings() {
  if (!browser) return null;
  
  // 캐시 확인
  if (settingsCache && (Date.now() - settingsCacheTime) < CACHE_DURATION) {
    return settingsCache;
  }
  
  try {
    const response = await fetch('/api/settings/autosave'); // 기존 API 경로 사용
    if (!response.ok) throw new Error('설정 조회 실패');
    
    const result = await response.json();
    if (!result.success) throw new Error(result.error || '설정 조회 실패');
    
    // 기존 API 응답 형태에 맞춤
    const config = result.config;
    const settings = {
      enabled: config.autosave_enabled,
      expiryHours: config.autosave_expiry_hours,
      cleanupOnRefresh: config.autosave_cleanup_on_refresh,
      targetMenus: config.autosave_target_menus || []
    };
    
    // 캐시 저장
    settingsCache = settings;
    settingsCacheTime = Date.now();
    
    return settings;
  } catch (error) {
    console.error('자동저장 설정 조회 실패:', error);
    return null;
  }
}

// 현재 사용자 ID 가져오기
function getCurrentUserId() {
  try {
    const token = document.cookie
      .split('; ')
      .find(row => row.startsWith('token='))
      ?.split('=')[1];
    
    if (!token) return 'anonymous';
    
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.id || 'anonymous';
  } catch {
    return 'anonymous';
  }
}

// 현재 페이지 ID 추출
export function getCurrentPageId() {
  if (!browser) return null;
  
  const path = window.location.pathname;
  const pathMap = {
    '/admin/product-management/product-registration': 'product-registration',
    '/admin/sales-registration': 'sales-registration',
    '/admin/product-stock': 'product-stock'
  };
  
  return pathMap[path] || null;
}

// 폼 데이터 수집
export function collectFormData() {
  if (!browser) return {};
  
  const formData = {};
  const inputs = document.querySelectorAll('input, textarea, select');
  
  inputs.forEach(input => {
    if (input.name && input.type !== 'hidden' && input.type !== 'file') {
      if (input.type === 'checkbox' || input.type === 'radio') {
        formData[input.name] = input.checked;
      } else {
        formData[input.name] = input.value;
      }
    }
  });
  
  return formData;
}

// 만료 시간 체크
function isExpired(savedData, expiryHours) {
  if (!savedData.timestamp) return true;
  
  const now = Date.now();
  const savedTime = new Date(savedData.timestamp).getTime();
  const expiryTime = expiryHours * 60 * 60 * 1000;
  
  return (now - savedTime) > expiryTime;
}

// 새로고침 감지 (Performance API 사용)
// 새로고침 감지 (개선된 버전)
function isPageRefresh() {
  if (!browser || !window.performance) return false;
  
  try {
    // 방법 1: Performance Navigation API
    const perfEntries = performance.getEntriesByType('navigation');
    if (perfEntries.length > 0) {
      const navEntry = perfEntries[0];
      // 실제 새로고침만 감지 (SPA 라우팅 제외)
      return navEntry.type === 'reload';
    }
    
    // 방법 2: 세션 스토리지 기반 감지
    const sessionKey = 'app_session_id';
    const currentSessionId = Date.now().toString();
    const lastSessionId = sessionStorage.getItem(sessionKey);
    
    if (!lastSessionId) {
      // 첫 방문이거나 새 세션
      sessionStorage.setItem(sessionKey, currentSessionId);
      return true; // 새로고침으로 간주
    }
    
    // 기존 세션과 같으면 SPA 라우팅
    return false;
    
  } catch (error) {
    console.error('새로고침 감지 오류:', error);
    return false;
  }
}



// 저장 키 생성
function getStorageKey(pageId) {
  const userId = getCurrentUserId();
  return `autosave_${userId}_${pageId}`;
}

// localStorage에 저장
async function saveToStorage(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error('localStorage 저장 실패:', error);
  }
}

// localStorage에서 로드
async function loadFromStorage(key) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : null;
  } catch (error) {
    console.error('localStorage 로드 실패:', error);
    return null;
  }
}

// 자동저장 데이터 삭제
async function clearAutoSavedData(pageId) {
  if (!browser) return;
  
  const key = getStorageKey(pageId);
  try {
    localStorage.removeItem(key);
    console.log(`자동저장 데이터 삭제: ${pageId}`);
  } catch (error) {
    console.error('자동저장 데이터 삭제 실패:', error);
  }
}

// 폼 데이터 복원
export async function restoreFormData(savedData) {
  if (!browser || !savedData?.formData) return;
  
  Object.entries(savedData.formData).forEach(([name, value]) => {
    const input = document.querySelector(`input[name="${name}"], textarea[name="${name}"], select[name="${name}"]`);
    if (input) {
      if (input.type === 'checkbox' || input.type === 'radio') {
        input.checked = value;
      } else {
        input.value = value;
      }
      
      // Svelte의 bind 업데이트를 위한 이벤트 발생
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
}

// 자동저장 데이터 로드 (메인 함수)
export async function loadAutoSavedData(pageId) {
  if (!browser || !pageId) return null;
  
  try {
    // 시스템 설정 확인
    const settings = await getAutoSaveSettings();
    if (!settings || !settings.enabled) return null;
    
    // 대상 메뉴 확인
    if (!settings.targetMenus.includes(pageId)) return null;
    
    // 새로고침 시 삭제 설정 확인
    if (settings.cleanupOnRefresh && isPageRefresh()) {
      await clearAutoSavedData(pageId);
      console.log(`새로고침 감지: ${pageId} 자동저장 데이터 삭제`);
      return null;
    }
    
    // 저장된 데이터 로드
    const key = getStorageKey(pageId);
    const savedData = await loadFromStorage(key);
    
    if (!savedData) return null;
    
    // 만료 시간 확인
    if (isExpired(savedData, settings.expiryHours)) {
      await clearAutoSavedData(pageId);
      console.log(`만료된 자동저장 데이터 삭제: ${pageId}`);
      return null;
    }
    
    // 복원 실행
    setTimeout(() => {
      restoreFormData(savedData);
      console.log(`자동저장 데이터 복원 완료: ${pageId}`, savedData.formData);
    }, 500);
    
    return savedData;
    
  } catch (error) {
    console.error('자동저장 데이터 로드 실패:', error);
    return null;
  }
}

// 자동저장 데이터 저장 (메인 함수)
export async function saveFormData(pageId) {
  if (!browser || !pageId) return;
  
  try {
    // 시스템 설정 확인
    const settings = await getAutoSaveSettings();
    if (!settings || !settings.enabled) return;
    
    // 대상 메뉴 확인
    if (!settings.targetMenus.includes(pageId)) return;
    
    // 폼 데이터 수집
    const formData = collectFormData();
    if (!formData || Object.keys(formData).length === 0) return;
    
    // 저장 데이터 구성
    const saveData = {
      pageId,
      timestamp: new Date().toISOString(),
      formData,
      expiryTime: Date.now() + (settings.expiryHours * 60 * 60 * 1000)
    };
    
    // 저장 실행
    const key = getStorageKey(pageId);
    await saveToStorage(key, saveData);
    
    console.log(`자동저장 완료: ${pageId}`, formData);
    
  } catch (error) {
    console.error('자동저장 실패:', error);
  }
}

// 모든 자동저장 데이터 삭제 (관리자용)
export async function clearAllAutoSavedData() {
  if (!browser) return;
  
  try {
    const settings = await getAutoSaveSettings();
    if (!settings) return;
    
    const userId = getCurrentUserId();
    settings.targetMenus.forEach(pageId => {
      const key = `autosave_${userId}_${pageId}`;
      localStorage.removeItem(key);
    });
    
    console.log('모든 자동저장 데이터 삭제 완료');
  } catch (error) {
    console.error('자동저장 데이터 삭제 실패:', error);
  }
}