import { resolveErnOSPackageRootSync } from "./src/infra/ernos-root.js";
console.log(resolveErnOSPackageRootSync({ cwd: process.cwd() }));
