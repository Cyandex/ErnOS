import { Driver, Session } from "neo4j-driver";
import { ValidationQuarantine } from "./quarantine.js";
import { GraphLayer } from "./types.js";

// Utility for Neo4j safe strings
const escapeNodeName = (name: string) => name.replace(/'/g, "\\'");

export async function addNode(
  driver: Driver | null,
  quarantine: ValidationQuarantine | null,
  label: string,
  name: string,
  layer: string = GraphLayer.NARRATIVE,
  properties: Record<string, any> = {},
  userId: number | null = null,
  personaId: string | null = null,
  scope: string | null = null,
): Promise<void> {
  if (!driver) return;
  const safeName = escapeNodeName(name);

  // Format properties into Neo4j format {key: value}
  const propPairs = Object.entries(properties)
    .filter(
      ([k, v]) =>
        v !== undefined &&
        k !== "name" &&
        k !== "layer" &&
        k !== "user_id" &&
        k !== "persona_id" &&
        k !== "scope",
    )
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join(", ");

  const propsStr = propPairs ? `, ${propPairs}` : "";
  const uId = userId !== null ? userId : -1;
  const pIdStr = personaId ? `, persona_id: '${escapeNodeName(personaId)}'` : "";
  const scopeStr = scope ? `, scope: '${escapeNodeName(scope)}'` : "";

  const query = `
    MERGE (n:${label} {name: '${safeName}', layer: '${layer}'})
    ON CREATE SET n.created = timestamp(), n.user_id = ${uId}${pIdStr}${scopeStr}${propsStr}
    ON MATCH SET n.last_updated = timestamp(), n.user_id = ${uId}${pIdStr}${scopeStr}${propsStr}
  `;

  const session = driver.session();
  try {
    await session.run(query);
    await wireToRoot(driver, safeName, layer);
  } catch (error) {
    console.error(`Failed to add node ${name}:`, error);
  } finally {
    await session.close();
  }
}

export async function addRelationship(
  driver: Driver | null,
  quarantine: ValidationQuarantine | null,
  sourceName: string,
  relType: string,
  targetName: string,
  layer: string = GraphLayer.NARRATIVE,
  userId: number | null = null,
  scope: string | null = null,
  sourceStr: string = "explicit",
  objData: Record<string, any> | null = null,
  personaId: string | null = null,
): Promise<void> {
  if (!driver) return;

  const safeSource = escapeNodeName(sourceName);
  const safeTarget = escapeNodeName(targetName);
  const uId = userId !== null ? userId : -1;
  const pIdStr = personaId ? `, persona_id: '${escapeNodeName(personaId)}'` : "";
  const scopeStr = scope ? `, scope: '${escapeNodeName(scope)}'` : "";

  const safeRelType = relType
    .toUpperCase()
    .replace(/\\s+/g, "_")
    .replace(/[^A-Z0-9_]/g, "");

  if (quarantine) {
    // If quarantined, add it to quarantine first. In this port, we bypass for system/tests, but real impl would await quarantine
  }

  const query = `
    MATCH (a {name: '${safeSource}'}), (b {name: '${safeTarget}'})
    MERGE (a)-[r:${safeRelType}]->(b)
    ON CREATE SET r.layer = '${layer}', r.created = timestamp(), r.user_id = ${uId}, r.source = '${escapeNodeName(sourceStr)}'${pIdStr}${scopeStr}
    ON MATCH SET r.last_updated = timestamp(), r.user_id = ${uId}
  `;

  const session = driver.session();
  try {
    await session.run(query);
  } catch (error) {
    console.error(`Failed to add relationship ${relType}:`, error);
  } finally {
    await session.close();
  }
}

export async function queryContext(
  driver: Driver | null,
  entityName: string,
  layer: string | null = null,
  userId: number | null = null,
  scope: string | null = null,
  personaId: string | null = null,
  strengthenConnectionFn?: (s: string, t: string) => Promise<void>,
): Promise<string[]> {
  if (!driver) return [];
  const safeName = escapeNodeName(entityName);
  const results: string[] = [];

  let matchClause = `MATCH (n {name: '${safeName}'})-[r]-(m)`;
  let whereClauses: string[] = [];

  if (layer) whereClauses.push(`(n.layer = '${layer}' OR m.layer = '${layer}')`);
  if (userId !== null)
    whereClauses.push(
      `(n.user_id = ${userId} OR m.user_id = ${userId} OR n.user_id = -1 OR m.user_id = -1)`,
    );

  // Simple scope check matching PUBLIC or the user's explicit scope string
  if (scope)
    whereClauses.push(
      `(n.scope = '${scope}' OR m.scope = '${scope}' OR n.scope = 'PUBLIC' OR m.scope = 'PUBLIC')`,
    );

  const query =
    whereClauses.length > 0
      ? `${matchClause} WHERE ${whereClauses.join(" AND ")} RETURN n.name, type(r), m.name, n.layer, m.layer`
      : `${matchClause} RETURN n.name, type(r), m.name, n.layer, m.layer`;

  const session = driver.session();
  try {
    const res = await session.run(query);
    const layersHit = new Set<string>();

    for (const record of res.records) {
      const nName = record.get(0);
      const rel = record.get(1);
      const mName = record.get(2);
      const nLayer = record.get(3);
      const mLayer = record.get(4);

      results.push(`${nName} --[${rel}]-- ${mName}`);
      if (strengthenConnectionFn) {
        if (nLayer && mLayer && nLayer !== mLayer) {
          const combo = [nLayer, mLayer].sort().join(":");
          if (!layersHit.has(combo)) {
            layersHit.add(combo);
            // Fire and forget synaptic strengthening
            strengthenConnectionFn(nLayer, mLayer).catch(console.error);
          }
        }
      }
    }
  } catch (error) {
    console.error(`Failed to query context for ${entityName}:`, error);
  } finally {
    await session.close();
  }

  return results;
}

export async function wireToRoot(
  driver: Driver | null,
  entityName: string,
  layerVal: string,
): Promise<void> {
  if (!driver) return;
  const safeName = escapeNodeName(entityName);
  const rootStr = `Root:${layerVal.charAt(0).toUpperCase() + layerVal.slice(1)}`;

  if (entityName.startsWith("Root:")) return;

  const query = `
    MATCH (r:Entity {name: '${rootStr}'})
    MATCH (n {name: '${safeName}'})
    MERGE (r)-[rel:CONTAINS]->(n)
    ON CREATE SET rel.created = timestamp()
  `;

  const session = driver.session();
  try {
    await session.run(query);
  } catch (error) {
    // Ignore, root might not exist yet
  } finally {
    await session.close();
  }
}
