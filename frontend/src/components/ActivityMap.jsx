import { useEffect, useRef } from "react"
import * as maplibregl from 'maplibre-gl'
import polyline from "@mapbox/polyline"
import 'maplibre-gl/dist/maplibre-gl.css'



export default function ActivityMap({ activities }) {
    const containerRef = useRef(null);
    const mapRef = useRef(null);

    // Create map
    useEffect(() => {
        mapRef.current = new maplibregl.Map({
            container: containerRef.current,
            style: 'https://tiles.openfreemap.org/styles/bright',
            center: [0,0],
            zoom: 1,
        });

        mapRef.current.on('load', () => {
            mapRef.current.addSource('activities', {
                type: 'geojson',
                data: {
                    type: "FeatureCollection",
                    features: [],
                },
            });

            mapRef.current.addLayer({
                id: 'activity-lines',
                type: 'line',
                source: 'activities',
                paint: {
                    'line-color': '#fc4c02',
                    'line-width': 3,
                    'line-opacity': 0.7,
                },
            });
        });

        return () => {
            mapRef.current?.remove();
            mapRef.current = null;
        }
    }, []);


    // Update route data
    useEffect(() => {
        if (!mapRef.current) return;
        if (!activities || !Array.isArray(activities)) return;

        const features = activities.flatMap((activity) => {
            if (!activity.summary_polyline) return [];

            const geometry = polyline.toGeoJSON(activity.summary_polyline);
            if (geometry.coordinates.length < 2) return [];

            return [
                {
                    type: 'Feature',
                    properties: {
                        id: activity.activity_id,
                        name: activity.name,
                    },
                    geometry,
                }
            ];
        });

        const routes = {
            type: "FeatureCollection",
            features,
        }


        const updateMap = () => {
            const source = mapRef.current.getSource("activities");

            if (source) {
                source.setData(routes);
            }

            const bounds = new maplibregl.LngLatBounds();

            features.forEach((feature) => {
                feature.geometry.coordinates.forEach((point) => {
                    bounds.extend(point);
                });
            });
            if (!bounds.isEmpty()) {
                mapRef.current.fitBounds(bounds, { padding: 40, maxZoom: 12 });
            }
        }

        if (mapRef.current.isStyleLoaded()) {
            updateMap();
        } else {
            mapRef.current.once("load", updateMap);
        }
    }, [activities]);

    return <div ref={containerRef} style={{ width: '100%', height: '500px'}} />
}