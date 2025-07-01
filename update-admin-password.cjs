const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

async function updatePassword() {
  console.log('🔧 admin123으로 비밀번호 업데이트 중...');
  
  const newHash = bcrypt.hashSync('admin123', 10);
  console.log('새 해시:', newHash);
  
  const pool = mysql.createPool({
    host: 'localhost',
    port: 21379,
    user: 'kimhojun',
    password: 'Rlaghwns2@',
    database: 'HOJUN'
  });
  
  const [result] = await pool.execute(
    'UPDATE users SET password = ? WHERE username = ?',
    [newHash, 'admin']
  );
  
  console.log('✅ 업데이트 결과:', result.affectedRows, '행 변경됨');
  
  // 확인
  const [rows] = await pool.execute(
    'SELECT username, LEFT(password, 20) as password_start FROM users WHERE username = ?',
    ['admin']
  );
  
  console.log('✅ 확인:', rows[0]);
  
  await pool.end();
  console.log('✅ 비밀번호 업데이트 완료! 이제 admin123으로 로그인 가능합니다.');
}

updatePassword().catch(console.error);
