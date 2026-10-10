import { QRCodeSVG } from "qrcode.react";

/**
 * The provisioning QR code of an authenticator app. A QR code needs a light ground and a quiet zone to scan, whatever
 * the theme, so it keeps a white panel. Shared by the account setting and the administrator enrollment.
 */
export function AuthenticatorQr({ uri, label, size = 176 }: { uri: string; label: string; size?: number }) {
  return (
    <div role="img" aria-label={label} className="w-fit rounded-xl border bg-white p-3">
      <QRCodeSVG value={uri} size={size} bgColor="#ffffff" fgColor="#000000" level="M" />
    </div>
  );
}
