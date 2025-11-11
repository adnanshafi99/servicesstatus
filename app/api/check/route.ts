import { NextRequest, NextResponse } from 'next/server';
import { checkAllUrls } from '@/lib/ping';

export async function POST() {
  try {
    await checkAllUrls();
    return NextResponse.json({ 
      success: true, 
      message: 'All URLs checked successfully' 
    });
  } catch (error: any) {
    return NextResponse.json({ 
      error: 'Failed to check URLs',
      message: error.message 
    }, { status: 500 });
  }
}




