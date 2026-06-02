import { NextResponse } from 'next/server'
import { getDbBolivia } from '@/lib/db'
import { retryPendingSyncs } from '@/lib/retrySync'

export async function GET() {
  try {
    const db = await getDbBolivia()
    
    // 1. Reset all errors back to pending
    const res = await db.request().query(`
      UPDATE sync_log 
      SET estado = 'PENDIENTE', intentos = 0 
      WHERE estado = 'ERROR' OR intentos > 0
    `)
    
    const rowsAffected = res.rowsAffected[0]
    
    // 2. Trigger the sync manually
    await retryPendingSyncs()
    
    return NextResponse.json({ 
      success: true, 
      message: `Reset ${rowsAffected} entries and triggered sync.`
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
