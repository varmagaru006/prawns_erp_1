import React from 'react';
import { Shield, ExternalLink } from 'lucide-react';

/**
 * Shown when a user hits /platform-admin in the client portal.
 * Directs them to use the standalone Super Admin portal instead of the in-app panel.
 */
const SUPER_ADMIN_PORTAL_URL =
  process.env.REACT_APP_SUPER_ADMIN_PORTAL_URL || '/super-admin/login';

export default function SuperAdminRedirect() {
  const isExternal = SUPER_ADMIN_PORTAL_URL.startsWith('http');
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-8 max-w-md w-full text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-100 text-purple-600 mb-6">
          <Shield className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold text-slate-800 mb-2">
          Super Admin Portal
        </h1>
        <p className="text-slate-600 mb-6">
          Tenant and feature management is done in the standalone Super Admin
          portal. Use the link below to open it.
        </p>
        <a
          href={SUPER_ADMIN_PORTAL_URL}
          target={isExternal ? '_blank' : '_self'}
          rel={isExternal ? 'noopener noreferrer' : undefined}
          className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition"
        >
          Open Super Admin Portal
          <ExternalLink className="w-4 h-4" />
        </a>
        <p className="text-xs text-slate-500 mt-6">
          If the link does not work, ask your administrator for the Super Admin
          portal URL.
        </p>
      </div>
    </div>
  );
}
