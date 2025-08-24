import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 21379,
    user: process.env.DB_USER || 'kimhojun',
    password: process.env.DB_PASSWORD || 'Rlaghwns2@',
    database: process.env.DB_NAME || 'HOJUN',
    waitForConnections: true,
    connectionLimit: 10
});

export function getDb() {
    return pool;
}

export async function findUser(username, password) {
    try {
        const [rows] = await pool.execute(
            'SELECT * FROM users WHERE username = ?',
            [username]
        );

        if (rows.length === 0) {
            return null;
        }

        const user = rows[0];
        const isValidPassword = bcrypt.compareSync(password, user.password);
        
        return isValidPassword ? user : null;
    } catch (error) {
        console.error('사용자 조회 오류:', error);
        return null;
    }
}
