import { NextRequest, NextResponse } from 'next/server';
import { clearAuthSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    await clearAuthSession();
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


