import { ShieldCheck } from "lucide-react";

interface OrgLogoProps {
  logoDarkUrl?: string | null;
  logoLightUrl?: string | null;
  variant: "dark" | "light";
  size?: number;
  className?: string;
}

export function OrgLogo({ logoDarkUrl, logoLightUrl, variant, size = 36, className = "" }: OrgLogoProps) {
  const url = variant === "dark" ? logoDarkUrl : logoLightUrl;

  if (url) {
    return (
      <img
        src={url}
        alt="Logo organización"
        style={{ width: size, height: size, objectFit: "contain" }}
        className={`shrink-0 ${className}`}
      />
    );
  }

  const bg = variant === "dark" ? "bg-white/10 border border-white/10 text-white" : "bg-zinc-950 text-white";
  const iconSize = Math.round(size * 0.52);

  return (
    <div
      className={`grid shrink-0 place-items-center rounded-xl ${bg} ${className}`}
      style={{ width: size, height: size }}
    >
      <ShieldCheck size={iconSize} />
    </div>
  );
}
