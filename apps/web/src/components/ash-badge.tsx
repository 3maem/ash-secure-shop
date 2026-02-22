'use client';

interface AshBadgeProps {
  mode: 'basic' | 'scoped' | 'unified' | null;
  verified?: boolean;
  proof?: string;
}

const modeColors = {
  basic: 'bg-blue-100 text-blue-800 border-blue-300',
  scoped: 'bg-purple-100 text-purple-800 border-purple-300',
  unified: 'bg-green-100 text-green-800 border-green-300',
};

export function AshBadge({ mode, verified, proof }: AshBadgeProps) {
  if (!mode) return null;

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-mono ${modeColors[mode]}`}>
      <span className={`w-2 h-2 rounded-full ${verified ? 'bg-green-500' : 'bg-red-500'}`} />
      <span>ASH:{mode.toUpperCase()}</span>
      {proof && <span className="opacity-60">{proof.slice(0, 8)}...</span>}
    </div>
  );
}
