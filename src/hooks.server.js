import { createAuthHandle } from '$lib/middleware/auth.js';

// API 권한 체크 미들웨어 적용
export const handle = createAuthHandle();
