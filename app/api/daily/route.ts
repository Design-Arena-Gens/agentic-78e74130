import { getDailyShort } from '@/lib/getDailyShort';
import { NextResponse } from 'next/server';

function isValidTimeZone(tz?: string | null): tz is string {
  if (!tz) return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch (error) {
    return false;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tzParam = searchParams.get('tz');
  const timeZone = isValidTimeZone(tzParam) ? tzParam : undefined;

  const payload = getDailyShort({ timeZone });

  return NextResponse.json(payload, {
    headers: {
      'Cache-Control': 'no-store, max-age=0'
    }
  });
}
