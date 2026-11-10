'use client';
import { CheckCircle2, XCircle } from 'lucide-react';

export default function PasswordRequirements({ password }: { password: string }) {
  const reqs = [
    { label: 'Minimal 8 karakter', valid: password.length >= 8 },
    { label: 'Huruf Besar (A-Z)', valid: /[A-Z]/.test(password) },
    { label: 'Angka (0-9)', valid: /[0-9]/.test(password) },
    { label: 'Simbol (!@#$...)', valid: /[^A-Za-z0-9]/.test(password) },
  ];

  return (
    <div className="mt-2 space-y-1 bg-gray-50 p-3 rounded-xl border border-gray-100">
      {reqs.map((req, idx) => (
        <div key={idx} className="flex items-center gap-2 text-xs">
          {req.valid ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
          ) : (
            <XCircle className="w-3.5 h-3.5 text-red-400" />
          )}
          <span className={req.valid ? 'text-green-600 font-medium' : 'text-gray-500'}>{req.label}</span>
        </div>
      ))}
    </div>
  );
}