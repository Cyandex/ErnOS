---
summary: "OmniGrid Enterprise OSINT Engine tools and layers"
read_when:
  - Using the OSINT mapping engine
  - Querying live satellite or cctv feeds
title: "OSINT Engine"
---

# OSINT Engine (OmniGrid)

ErnOS provides an enterprise-grade spatio-temporal intelligence engine called **OmniGrid**. It caches and normalizes live geospatial event data into a local SQLite database and provides interactive map rendering natively via Kepler.gl integration.

## Available Tools

The OSINT suite provides several specific query tools and a unified map rendering tool.

### `render_osint_map`

Renders an interactive 3D map of the given bounding box and activates specific intelligence intelligence layers. The map is rendered natively in the ErnOS UI.

**Required Parameters:**
- `bbox`: Array of `[min_lon, min_lat, max_lon, max_lat]`
- `layers_to_enable`: Array of layers to toggle on the map.

**Available Layers:**
- `adsb`: Live aviation traffic
- `ais`: Live maritime shipping traffic
- `acled`: Global conflict and protest events
- `gdacs`: Global disaster alerts
- `weather`: Live precipitation and radar data
- `firms`: NASA VIIRS/MODIS thermal anomalies and fires
- `gdelt`: Global news sentiment and events
- `webcams`: Live public CCTV and traffic cameras

### `osint_search_weather`

Queries the live weather cache to find severe precipitation or weather anomalies within a geographic bounding box. Returns normalized event data.

### `osint_search_webcams`

Queries the live CCTV traffic camera cache (via Windy Webcams API integration) within a bounding box. Returns details on cameras, their status, and URLs to live feeds/images.

## Architecture

The OmniGrid architecture uses a unified `omnigrid_events` schema in SQLite to normalize disparate data sources (points, trails, and events) into a standard format. Background workers fetch from respective providers continuously, allowing sub-second cross-domain correlation.
