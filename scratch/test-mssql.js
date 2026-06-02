const sql = require('mssql')

async function run() {
  try {
    const req = new sql.Request();
    
    req.input('tabla', sql.VarChar(50), 'sucursal');
    req.input('payload', sql.NVarChar(sql.MAX), JSON.stringify({a: 1}));
    
    console.log("Validation passed for MAX");
    
  } catch(e) {
    console.error(e.message);
  }
}
run();
