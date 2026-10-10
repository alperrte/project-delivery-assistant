import type { MetadataRoute } from "next";

/** Name, colours and icons used when the site is added to a home screen. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PDA · Project Delivery Assistant",
    short_name: "PDA",
    description: "Öğrenciler ve küçük ekipler için self-hosted proje teslim asistanı.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f6f9",
    theme_color: "#f4f6f9",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
