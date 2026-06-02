require('dotenv').config({ path: '.env.bolivia' });
const sql = require('mssql');

async function run() {
  try {
    const pool = new sql.ConnectionPool({
      user: process.env.DB_BOLIVIA_USER,
      password: process.env.DB_BOLIVIA_PASSWORD,
      server: process.env.DB_BOLIVIA_HOST || 'localhost',
      database: process.env.DB_BOLIVIA_NAME,
      options: { encrypt: false, trustServerCertificate: true },
    });
    
    await pool.connect();
    
    // Reset ERROR to PENDIENTE
    const result = await pool.request().query(`
      UPDATE sync_log 
      SET estado = 'PENDIENTE', intentos = 0 
      WHERE estado = 'ERROR' OR intentos > 0
    `);
    
    console.log(`Reset ${result.rowsAffected[0]} records in sync_log back to PENDIENTE.`);
    
    // Also, let's just trigger the retry directly
    // Wait, retryPendingSyncs is written in TS. I will just let the cron job run, 
    // or we can call it if the app is running.
    
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}

run();
