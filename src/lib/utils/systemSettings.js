import { getDb } from '$lib/database.js';

// 시스템 설정 캐시 (성능 향상)
let settingsCache = {};
let cacheExpiry = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5분

// 시스템 설정 조회
export async function getSystemSetting(key, defaultValue = null) {
  try {
    // 캐시 확인
    if (cacheExpiry > Date.now() && settingsCache[key] !== undefined) {
      return settingsCache[key];
    }

    const db = getDb();
    const [rows] = await db.execute(
      'SELECT setting_value, setting_type FROM system_settings WHERE setting_key = ?',
      [key]
    );

    if (rows.length === 0) {
      settingsCache[key] = defaultValue;
      return defaultValue;
    }

    const { setting_value, setting_type } = rows[0];
    let value = setting_value;

    // 타입 변환
    switch (setting_type) {
      case 'number':
        value = parseFloat(setting_value);
        break;
      case 'boolean':
        value = setting_value === 'true' || setting_value === '1';
        break;
      case 'json':
        try {
          value = JSON.parse(setting_value);
        } catch {
          value = setting_value;
        }
        break;
    }

    settingsCache[key] = value;
    cacheExpiry = Date.now() + CACHE_DURATION;
    
    return value;
  } catch (error) {
    console.error('시스템 설정 조회 오류:', error);
    return defaultValue;
  }
}

// 여러 설정 한번에 조회
export async function getSystemSettings(keys) {
  const settings = {};
  for (const key of keys) {
    settings[key] = await getSystemSetting(key);
  }
  return settings;
}

// 캐시 무효화
export function clearSettingsCache() {
  settingsCache = {};
  cacheExpiry = 0;
}

// 점검 모드 확인
export async function isMaintenanceMode() {
  return await getSystemSetting('maintenance_mode', false);
}

// 회원가입 허용 여부
export async function isRegistrationEnabled() {
  return await getSystemSetting('enable_registration', false);
}

// 최대 로그인 시도 횟수
export async function getMaxLoginAttempts() {
  return await getSystemSetting('max_login_attempts', 5);
}

// 세션 만료 시간 (시간 단위)
export async function getSessionTimeout() {
  return await getSystemSetting('session_timeout', 24);
}

// 사이트 정보
export async function getSiteInfo() {
  return await getSystemSettings(['site_name', 'site_description', 'admin_email']);
}
