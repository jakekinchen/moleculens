import { NextRequest, NextResponse } from 'next/server';
import { getJob } from '@/lib/jobStore';

export async function GET(_req: NextRequest, props: { params: Promise<{ jobId: string }> }) {
  const params = await props.params;
  const job = getJob(params.jobId);
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }
  return NextResponse.json(job);
}
