import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export class SaltRotationDaemon {
  private saltPath: string;

  constructor(saltPath = path.join(process.cwd(), "memory", "system", "crypto.salt")) {
    this.saltPath = saltPath;
  }

  /**
   * Generates a new cryptographically secure salt.
   */
  private generateSalt(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  /**
   * Rotates the system salt, typically called via a cron job (e.g., monthly).
   * Note: In a real system, rotating a salt requires migrating all currently hashed PII data.
   */
  public async rotateSalt(): Promise<void> {
    console.log("[Security] Initiating cryptographic salt rotation...");

    const newSalt = this.generateSalt();

    // Ensure directory exists
    const dir = path.dirname(this.saltPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // Backup old salt if it exists
    if (fs.existsSync(this.saltPath)) {
      const backupPath = `${this.saltPath}.bak`;
      fs.copyFileSync(this.saltPath, backupPath);
      console.log(`[Security] Backed up old salt to ${backupPath}`);
    }

    // Save new salt
    fs.writeFileSync(this.saltPath, newSalt, "utf-8");
    console.log("[Security] Salt rotation complete. NOTE: PII hash migration deferred.");
  }

  /**
   * Hashes a PII string (e.g. email) using the current salt.
   */
  public hashPII(data: string): string {
    if (!fs.existsSync(this.saltPath)) {
      this.rotateSalt(); // force init
    }
    const salt = fs.readFileSync(this.saltPath, "utf-8");
    const hash = crypto.createHmac("sha256", salt).update(data).digest("hex");
    return hash;
  }
}

export const saltRotator = new SaltRotationDaemon();
