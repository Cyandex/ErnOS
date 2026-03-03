import { resolveErnOSPackageRootSync } from "./dist/index.js";
console.log(resolveErnOSPackageRootSync({ cwd: process.cwd() }));
