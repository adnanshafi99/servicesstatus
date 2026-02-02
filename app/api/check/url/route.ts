import { NextRequest, NextResponse } from 'next/server';
import { checkUrl } from '@/lib/ping';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { urlId } = body;

    if (!urlId || typeof urlId !== 'number') {
      return NextResponse.json(
        { error: 'urlId is required and must be a number' },
        { status: 400 }
      );
    }

    const result = await checkUrl(urlId);
    
    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error: any) {
    console.error('Error checking URL:', error);
    return NextResponse.json(
      { 
        error: 'Failed to check URL',
        message: error.message 
      },
      { status: 500 }
    );
  }
}









