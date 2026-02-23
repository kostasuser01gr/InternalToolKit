"use client";

import { QRCodeSVG } from "qrcode.react";

export function ShareQrCode({ url }: { url: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-md border border-[var(--border)] bg-white p-3">
      <QRCodeSVG value={url} size={160} level="M" />
      <span className="text-xs text-gray-500">Scan to open Washer App</span>
    </div>
  );
}
