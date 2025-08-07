export type JobStatus = 'processing' | 'completed' | 'failed';

export interface JobInfo {
  id: string;
  status: JobStatus;
  progress?: number;
  result?: unknown;
  error?: string;
}

const jobMap = new Map<string, JobInfo>();

export function createJob(initial: Partial<JobInfo> = {}): JobInfo {
  const id = initial.id ?? Math.random().toString(36).slice(2);
  const job: JobInfo = {
    id,
    status: initial.status ?? 'processing',
    ...(initial.progress !== undefined && { progress: initial.progress }),
    result: initial.result,
    ...(initial.error && { error: initial.error }),
  };
  jobMap.set(id, job);
  return job;
}

export function updateJob(id: string, patch: Partial<JobInfo>): JobInfo | undefined {
  const job = jobMap.get(id);
  if (!job) return undefined;
  Object.assign(job, patch);
  jobMap.set(id, job);
  return job;
}

export function getJob(id: string): JobInfo | undefined {
  return jobMap.get(id);
}
