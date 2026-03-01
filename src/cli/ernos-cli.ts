import type { Command } from "commander";
import { formatDocsLink } from "../terminal/links.js";
import { theme } from "../terminal/theme.js";
import { registerQrCli } from "./qr-cli.js";

export function registerErnOSCli(program: Command) {
  const ernos = program
    .command("ernos")
    .description("Legacy ernos command aliases")
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted("Docs:")} ${formatDocsLink("/cli/ernos", "docs.ernos.ai/cli/ernos")}\n`,
    );
  registerQrCli(ernos);
}
