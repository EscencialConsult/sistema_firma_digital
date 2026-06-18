import { ShieldCheck } from "lucide-react";
import { useState } from "react";

interface OrgLogoProps {
  logoDarkUrl?: string | null;
  logoLightUrl?: string | null;
  variant: "dark" | "light";
  size?: number;
  className?: string;
}

export function OrgLogo({ logoDarkUrl, logoLightUrl, variant, size = 36, className = "" }: OrgLogoProps) {
  const [imgError, setImgError] = useState(false);
  const url = variant === "dark" ? logoDarkUrl : logoLightUrl;

  const bg = variant === "dark"
    ? "bg-white/10 border border-white/10 text-white"
    : "bg-zinc-950 text-white";

  if (url && !imgError) {
    return (
      <img
        src={url}
        alt="Logo organización"
        onError={() => setImgError(true)}
        style={{ width: size, height: size, objectFit: "contain" }}
        className={`shrink-0 rounded-lg ${className}`}
      />
    );
  }

  return (
    <div
      className={`grid shrink-0 place-items-center rounded-xl ${bg} ${className}`}
      style={{ width: size, height: size }}
    >
      <ShieldCheck size={Math.round(size * 0.52)} />
    </div>
  );
}
