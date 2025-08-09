"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

type FigureStatus = {
  spec_id: string;
  status: 'queued' | 'processing' | 'ready' | 'failed' | string;
  assets?: Record<string, string>;
  error?: string;
  detail?: any;
};

export default function FigureViewerPage() {
  const params = useParams<{ spec_id: string }>();
  const router = useRouter();
  const specId = useMemo(() => (params?.spec_id as string) || '', [params]);
  const [data, setData] = useState<FigureStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!specId) return;
    let isCancelled = false;

    async function poll() {
      setIsLoading(true);
      setError(null);
      try {
        const r = await fetch(`/api/figure/${encodeURIComponent(specId)}`);
        const text = await r.text();
        if (!r.ok) throw new Error(text || `status ${r.status}`);
        const json = JSON.parse(text);
        if (isCancelled) return;
        setData(json);
        if (json?.status && ['ready', 'failed'].includes(json.status)) {
          setIsLoading(false);
          return; // stop polling
        }
      } catch (e: any) {
        if (isCancelled) return;
        setError(e?.message || 'Failed to load status');
        setIsLoading(false);
        return;
      }
      // schedule next poll
      setTimeout(poll, 1500);
    }

    poll();
    return () => {
      isCancelled = true;
    };
  }, [specId]);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#0b0f1a] text-white">
      <div className="max-w-5xl mx-auto px-6 py-10 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Figure Status</h1>
          <Link href="/research" className="text-sm text-blue-300 hover:underline">
            ← Back to Research
          </Link>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-6 space-y-4">
          <div className="text-sm text-gray-300">
            <span className="font-mono text-gray-200">spec_id:</span> {specId}
          </div>
          {isLoading && <div className="text-sm text-gray-300">Checking status…</div>}
          {error && (
            <div className="text-sm text-red-300">
              Error: {error}
            </div>
          )}

          {data && (
            <div className="space-y-3">
              <div className="text-sm">
                <span className="text-gray-300">Status:</span>{' '}
                <span className="font-medium">{data.status}</span>
              </div>

              {data.assets && Object.keys(data.assets).length > 0 ? (
                <div className="space-y-2">
                  <div className="text-sm text-gray-300">Assets</div>
                  <ul className="list-disc pl-6 space-y-1">
                    {Object.entries(data.assets).map(([name, url]) => (
                      <li key={name} className="text-sm">
                        <a className="text-blue-300 hover:underline break-all" href={url} target="_blank" rel="noreferrer">
                          {name}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="text-sm text-gray-400">No assets yet.</div>
              )}

              {data.detail && (
                <pre className="text-xs whitespace-pre-wrap break-words bg-black/30 p-3 rounded">{JSON.stringify(data.detail, null, 2)}</pre>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


