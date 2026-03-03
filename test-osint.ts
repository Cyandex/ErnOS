import { osintSkills } from './src/skills/osint/osint-orchestrator.js';

async function test() {
    console.log("Locating tool...");
    const renderTool = osintSkills.find(s => s.name === "render_osint_map");
    console.log("Executing map render with all layers...");
    const res = await renderTool.execute("test-id", {
        view_latitude: 45.0,
        view_longitude: 0.0,
        zoom_level: 5,
        lamin: 40.0,
        lomin: -5.0,
        lamax: 50.0,
        lomax: 5.0,
        layers_to_enable: ["aviation", "maritime", "disasters", "firms", "gdelt", "weather"]
    });
    console.log("Success! Output JSON payload length:", res.content[0].text.length);
}
test().catch(console.error);
