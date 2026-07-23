import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/api/auth';
import { connectToDatabase } from '@/database/mongoose';
import { getLatestAiReport } from '@/database/models/aiReport.model';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const apiKey = await authenticateApiRequest(request);
  if (!apiKey) {
    return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 });
  }

  const { symbol } = await params;
  await connectToDatabase();
  const report = await getLatestAiReport(symbol.toUpperCase());

  if (!report) {
    return NextResponse.json({ error: 'No report found' }, { status: 404 });
  }

  return NextResponse.json({
    symbol: report.symbol,
    summary: report.summary,
    confidence: report.confidence,
    signals: report.signals,
    sources: report.sources,
    createdAt: report.createdAt,
  });
}
