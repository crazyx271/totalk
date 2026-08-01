"use client";

import { useEffect, useState } from "react";

export type DesktopDownload = {
  href: string;
  label: string;
  platform: "windows" | "mac-arm64" | "mac-x64";
};

const WINDOWS_DOWNLOAD: DesktopDownload = {
  href: "/downloads/ToTalk-Setup.exe",
  label: "Скачать для Windows",
  platform: "windows",
};

export function useDesktopDownload() {
  const [download, setDownload] = useState<DesktopDownload>(WINDOWS_DOWNLOAD);

  useEffect(() => {
    const userAgent = navigator.userAgent;
    if (!/Macintosh|Mac OS X/i.test(userAgent)) return;

    const selectMacBuild = (architecture?: string) => {
      const intel = /x86|x64|amd64/i.test(architecture ?? "");
      setDownload(intel ? {
        href: "/downloads/ToTalk-0.2.1-mac-x64.dmg",
        label: "Скачать для Mac с Intel",
        platform: "mac-x64",
      } : {
        href: "/downloads/ToTalk-0.2.1-mac-arm64.dmg",
        label: "Скачать для Mac",
        platform: "mac-arm64",
      });
    };

    selectMacBuild();
    const userAgentData = (navigator as Navigator & {
      userAgentData?: { getHighEntropyValues?: (hints: string[]) => Promise<{ architecture?: string }> };
    }).userAgentData;
    void userAgentData?.getHighEntropyValues?.(["architecture"])
      .then((values) => selectMacBuild(values.architecture))
      .catch(() => undefined);
  }, []);

  return download;
}
