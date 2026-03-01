export class HomeAssistantClient {
  private url: string;
  private token: string;

  constructor() {
    this.url = process.env.HA_URL || "";
    this.token = process.env.HA_TOKEN || "";
  }

  private isConfigured() {
    return this.url.length > 0 && this.token.length > 0;
  }

  private async request(endpoint: string, method = "GET", body?: any) {
    if (!this.isConfigured()) throw new Error("Home Assistant URL or Token not configured.");

    const res = await fetch(`${this.url}${endpoint}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      throw new Error(`HA API Error: ${res.status} ${res.statusText}`);
    }

    return res.json();
  }

  /**
   * Get the current state of a specific entity (e.g., light.living_room)
   */
  public async getState(entityId: string) {
    return this.request(`/api/states/${entityId}`);
  }

  /**
   * Get all states to summarize the house (filtered to relevant domains)
   */
  public async getSensorSummary() {
    const states: any[] = await this.request("/api/states");
    return states
      .filter(
        (s) =>
          s.entity_id.startsWith("sensor.") ||
          s.entity_id.startsWith("light.") ||
          s.entity_id.startsWith("climate."),
      )
      .map((s) => ({ id: s.entity_id, state: s.state, name: s.attributes.friendly_name }));
  }

  /**
   * Call any Home Assistant service
   */
  public async callService(
    domain: string,
    service: string,
    entityId: string,
    additionalData: any = {},
  ) {
    return this.request(`/api/services/${domain}/${service}`, "POST", {
      entity_id: entityId,
      ...additionalData,
    });
  }

  /**
   * Convenience for toggling lights/switches
   */
  public async toggle(entityId: string) {
    const domain = entityId.split(".")[0];
    return this.callService(domain, "toggle", entityId);
  }
}

export const homeAssistant = new HomeAssistantClient();
