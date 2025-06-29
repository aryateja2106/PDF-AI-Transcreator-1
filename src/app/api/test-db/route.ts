import { NextResponse } from 'next/server';
import { dbUtils } from '@/lib/database';

export async function GET() {
  try {
    console.log('Testing database connection...');
    
    // Get database stats to ensure it's working
    const stats = dbUtils.getStats();
    
    return NextResponse.json({
      success: true,
      message: 'Database connection successful',
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Database test failed:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
} 