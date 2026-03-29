'use client';

interface ImportRecord {
  id: string;
  filename: string;
  date: string;
  total_records: number;
  added: number;
  removed: number;
  changed: number;
  trigger: 'auto' | 'manual';
}

interface ImportHistoryProps {
  imports: ImportRecord[];
  loading: boolean;
}

export function ImportHistory({ imports, loading }: ImportHistoryProps) {
  if (loading) {
    return (
      <div className="border border-s3 bg-s1 p-4">
        <div className="h-48 animate-pulse bg-s2/30" />
      </div>
    );
  }

  return (
    <div className="border border-s3 bg-s1">
      <div className="px-4 py-3">
        <h3 className="font-data text-[10px] font-bold uppercase tracking-widest text-amber">
          IMPORT HISTORY
        </h3>
      </div>
      <table className="w-full">
        <thead>
          <tr className="border-b border-amber/20">
            <th className="px-4 py-1.5 text-left font-data text-[9px] font-bold uppercase tracking-widest text-dim">FILE</th>
            <th className="px-4 py-1.5 text-left font-data text-[9px] font-bold uppercase tracking-widest text-dim">DATE</th>
            <th className="px-4 py-1.5 text-right font-data text-[9px] font-bold uppercase tracking-widest text-dim">RECORDS</th>
            <th className="px-4 py-1.5 text-right font-data text-[9px] font-bold uppercase tracking-widest text-dim">ADDED</th>
            <th className="px-4 py-1.5 text-right font-data text-[9px] font-bold uppercase tracking-widest text-dim">REMOVED</th>
            <th className="px-4 py-1.5 text-right font-data text-[9px] font-bold uppercase tracking-widest text-dim">CHANGED</th>
            <th className="px-4 py-1.5 text-center font-data text-[9px] font-bold uppercase tracking-widest text-dim">TRIGGER</th>
          </tr>
        </thead>
        <tbody>
          {imports.map((imp) => (
            <tr key={imp.id} className="border-b border-s3/50 transition-colors hover:bg-amber/5">
              <td className="max-w-[200px] truncate px-4 py-2 font-data text-xs text-text">
                {imp.filename}
              </td>
              <td className="px-4 py-2 font-data text-[10px] text-muted">
                {new Date(imp.date).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </td>
              <td className="px-4 py-2 text-right font-data text-xs text-dim">
                {imp.total_records.toLocaleString()}
              </td>
              <td className="px-4 py-2 text-right font-data text-xs font-bold text-green">
                +{imp.added.toLocaleString()}
              </td>
              <td className="px-4 py-2 text-right font-data text-xs font-bold text-red">
                -{imp.removed.toLocaleString()}
              </td>
              <td className="px-4 py-2 text-right font-data text-xs font-bold text-amber">
                {imp.changed.toLocaleString()}
              </td>
              <td className="px-4 py-2 text-center">
                <span className={`inline-block px-1.5 py-0.5 font-data text-[8px] font-bold ${
                  imp.trigger === 'auto' ? 'bg-blue text-bg' : 'bg-purple text-bg'
                }`}>
                  {imp.trigger.toUpperCase()}
                </span>
              </td>
            </tr>
          ))}
          {imports.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center font-data text-xs text-dim">
                NO IMPORT HISTORY AVAILABLE.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
