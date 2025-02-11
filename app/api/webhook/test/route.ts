import { NextResponse } from 'next/server'
import { headers } from 'next/headers'

export async function POST(req: Request) {
  try {
    // Log all headers
    const headersList = await headers();
    const allHeaders: Record<string, string> = {};
    
    // Get all headers as entries
    Array.from(headersList.entries()).forEach(([key, value]) => {
      allHeaders[key] = value;
    });
    
    console.log('Headers received:', allHeaders);

    // Log body
    const body = await req.json();
    console.log('Body received:', body);

    return NextResponse.json({ 
      message: 'Test webhook received', 
      headers: allHeaders,
      body 
    })
  } catch (error) {
    console.error('Test webhook error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { 
      status: 500 
    })
  }
} 