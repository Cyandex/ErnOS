import { vi } from "vitest";
import { installChromeUserDataDirHooks } from "./chrome-user-data-dir.test-harness.js";

const chromeUserDataDir = { dir: "/tmp/ernos" };
installChromeUserDataDirHooks(chromeUserDataDir);

vi.mock("./chrome.js", () => ({
  isChromeCdpReady: vi.fn(async () => true),
  isChromeReachable: vi.fn(async () => true),
  launchErnOSChrome: vi.fn(async () => {
    throw new Error("unexpected launch");
  }),
  resolveErnOSUserDataDir: vi.fn(() => chromeUserDataDir.dir),
  stopErnOSChrome: vi.fn(async () => {}),
}));
