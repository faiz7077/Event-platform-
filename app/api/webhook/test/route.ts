import { NextResponse } from 'next/server'
import { headers } from 'next/headers'

export async function POST(req: Request) {
  try {
    // Log all headers
    const headersList = headers();
    const allHeaders = {};
    headersList.forEach((value, key) => {
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
      error: error.message 
    }, { 
      status: 500 
    })
  }
} 