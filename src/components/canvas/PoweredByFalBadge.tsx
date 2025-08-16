import React from "react";
import Link from "next/link";
import { LogoIcon } from "@/components/icons/logo";

export const PoweredByFalBadge: React.FC = () => {
  return (
    <div className="absolute bottom-6 left-6 z-20 hidden md:block">
      <Link
        href="https://fal.ai"
        target="_blank"
        className="bg-zinc-900/90 backdrop-blur-sm border border-zinc-800 p-3 flex flex-row rounded-xl gap-2 items-center hover:bg-zinc-800/90 transition-colors"
      >
        <LogoIcon className="w-6 h-6 text-white" />
        <div className="text-xs text-white">
          Powered by <span className="font-bold">fal</span>
        </div>
      </Link>
    </div>
  );
};
