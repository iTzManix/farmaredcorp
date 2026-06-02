import { NextResponse } from 'next/server'
import sql from 'mssql'

export async function GET() {
  try {
    const vc = sql.VarChar(50);
    const hasValidate = typeof vc.validate === 'function' || (vc.type && typeof vc.type.validate === 'function');
    
    return NextResponse.json({ 
      success: true, 
      vc, 
      hasValidate,
      sqlType: typeof sql.VarChar,
      isFunction: typeof sql.VarChar === 'function'
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message, stack: error.stack })
  }
}
