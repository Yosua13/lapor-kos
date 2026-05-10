'use client';

import { useEffect, useState } from 'react';

export default function Home() {
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('http://localhost:8081/api/health')
      .then((res) => res.json())
      .then((data) => {
        setHealth(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to fetch health status:', err);
        setLoading(false);
      });
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-900 text-white">
      <div className="z-10 max-w-5xl w-full items-center justify-center font-mono text-sm flex flex-col gap-8">
        <h1 className="text-6xl font-bold bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">
          Lapor Kos
        </h1>
        
        <div className="p-8 bg-gray-800 rounded-2xl border border-gray-700 shadow-2xl w-full max-w-md">
          <h2 className="text-2xl font-semibold mb-4">System Status</h2>
          
          {loading ? (
            <p className="animate-pulse text-gray-400">Checking backend connection...</p>
          ) : health ? (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span>API Status:</span>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${health.status === 'UP' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                  {health.status}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>Database:</span>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${health.database === 'Connected' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                  {health.database}
                </span>
              </div>
              <p className="text-gray-400 mt-4 italic text-center">"{health.message}"</p>
            </div>
          ) : (
            <div className="text-center space-y-2">
              <p className="text-red-400 font-bold">Backend Unreachable</p>
              <p className="text-xs text-gray-500">Make sure the Golang server is running on port 8081</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
