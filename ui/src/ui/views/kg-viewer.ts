import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
// Mock import for d3-force-3d or three.js (assuming it would be added to package.json)
// import ForceGraph3D from '3d-force-graph';

@customElement("kg-viewer")
export class KGViewer extends LitElement {
  @property({ type: Array }) nodes = [];
  @property({ type: Array }) links = [];

  static styles = css`
    :host {
      display: block;
      width: 100%;
      height: 100vh;
      background: #111;
      color: white;
    }
    #graph-container {
      width: 100%;
      height: calc(100% - 60px);
    }
    .toolbar {
      height: 60px;
      padding: 10px;
      display: flex;
      gap: 10px;
      background: var(--surface-2);
      align-items: center;
    }
    button {
      padding: 8px 16px;
      background: var(--accent);
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
  `;

  private graphInstance: any;

  firstUpdated() {
    this.initGraph();
  }

  async initGraph() {
    const container = this.shadowRoot?.getElementById("graph-container");
    if (!container) return;

    // Fetch data via Gateway API (mocked here based on V4 architecture)
    try {
      // const res = await window.api.call('kg.getGraphData');
      // this.nodes = res.nodes;
      // this.links = res.links;

      // Mock data
      this.nodes = [
        { id: "Root:Narrative", group: 1 },
        { id: "User(Bob)", group: 2 },
      ] as any;
      this.links = [{ source: "Root:Narrative", target: "User(Bob)", type: "CONTAINS" }] as any;

      this.renderGraph(container);
    } catch (e) {
      console.error("Failed to load KG data", e);
    }
  }

  renderGraph(container: HTMLElement) {
    // Ported from 3D-force-graph setup
    /*
    this.graphInstance = ForceGraph3D()(container)
      .graphData({ nodes: this.nodes, links: this.links })
      .nodeAutoColorBy('group')
      .nodeLabel('id')
      .linkDirectionalArrowLength(3.5)
      .linkDirectionalArrowRelPos(1)
      .onNodeClick((node: any) => {
         console.log('Clicked node:', node.id);
         // Implement zoom/focus behavior
      });
    */
    container.innerHTML =
      '<div style="padding: 20px;">[3D Force Graph Rendered placeholder. Run `npm i 3d-force-graph` to activate.]</div>';
  }

  render() {
    return html`
      <div class="toolbar">
        <h3>Synaptic Knowledge Graph</h3>
        <button @click="\${this.initGraph}">Refresh</button>
        <button>Filter Layer</button>
      </div>
      <div id="graph-container"></div>
    `;
  }
}
