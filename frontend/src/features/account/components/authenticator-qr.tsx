"use client";

import dynamic from "next/dynamic";

// The QR encoder is only needed on the two-factor setup screens, so it is its own chunk instead of part of every account
// and admin page. The square below it keeps its final size meanwhile, so nothing moves when the code appears.
const QrCode = dynamic(() => import("qrcode.react").then(module => module.QRCodeSVG), { ssr: false });

/**
 * The provisioning QR code of an authenticator app. A QR code needs a light ground and a quiet zone to scan, whatever
 * the theme, so it keeps a white panel. Shared by the account setting and the administrator enrollment.
 */
export function AuthenticatorQr({ uri, label, size = 176 }: { uri: string; label: string; size?: number }) {
  return (
    <div role="img" aria-label={label} className="w-fit rounded-xl border bg-white p-3">
      <div style={{ width: size, height: size }}>
        <QrCode value={uri} size={size} bgColor="#ffffff" fgColor="#000000" level="M" />
      </div>
    </div>
  );
}
