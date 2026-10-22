import { useEffect, useState } from "react";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts"

import { getActivityMetrics } from "../api/activities";
import "./ActivityMetricChart.css"

function formatPace(seconds) {
    if (seconds == null) return "-";

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);

    return `${minutes}:${String(remainingSeconds).padStart(2, "0")} min/km`;
}


function ActivityMetricChart({ activity }) {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedMetric, setSelectedMetric] = useState("pace")
    
    useEffect(() => {
        console.log("Chart data:", data);
    }, [data]);
    
    useEffect(() => {
        if (!activity) {
            setData([]);
            return;
        }
        
        getActivityMetrics(activity.activity_id)
        .then(setData)
        .catch(console.error)
        .finally(() => {
            setLoading(false);
        });
    }, [activity?.activity_id]);
    
    if (!activity) {
        return null;
    }
    
    if (loading) {
        return (
            <div className="activity-metrics-card">
                Loading per-km data...
            </div>
        );
    }
    
    const paceValues = data.map((split) => split.pace_Seconds).filter((value) => Number.isFinite(value));
    
    const fastestPace = Math.min(...paceValues);
    const slowestPace = Math.min(...paceValues);
    
    const paceMin = Math.max(120, fastestPace - 30);
    const paceMax = slowestPace + 30;
    
    let dataKey;
    let label;
    let formatter;
    let reversed = false;
    let domain;

    if (selectedMetric === "pace") {
        dataKey = "pace_Seconds";
        label = "Pace";
        formatter = formatPace;
        reversed = true;
        domain = [paceMin, paceMax];
    } else if (selectedMetric === "hr") {
        dataKey = "average_hr";
        label = "Heart Rate";
        formatter = (value) => `${value} bpm`;
        domain = ["auto", "auto"];
    } else {
        dataKey = "elevation_gain";
        label = "Elevation Gain";
        formatter = (value) => `${value} m`;
        domain = ["auto", "auto"];
    }

    return (
        <div className="activity-metric-card">
            <h3>Per-km Analysis</h3>
            <div className="metric-buttons">
                <button className={
                    selectedMetric === "pace" ? "metric-button active" : "metric-button"
                }
                onClick={() => setSelectedMetric("pace")}
                > 
                    Pace 
                </button>

                <button className={
                    selectedMetric === "hr" ? "metric-button active" : "metric-button"
                }
                onClick={() => setSelectedMetric("hr")}
                >
                    HR
                </button>

                <button className={
                    selectedMetric === "elevation" ? "metric-button active" : "metric-button"
                    }
                    onClick={() => setSelectedMetric("elevation")}
                >
                    Elevation
                </button>
            </div>
            <div className="metric-chart">
                
                <ResponsiveContainer
                width="100%"
                height="100%"
                >
                    <LineChart data={data}  margin={{top: 30, right: 15, left: 20, bottom: 30}}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                            dataKey="km"
                            label={{
                                value: "KM",
                                position: "insideBottom",
                                offset: -10
                            }}
                        />
                        <YAxis 
                            tickFormatter={formatter} 
                            reversed={reversed}
                            domain={domain}
                        />
                        <Tooltip
                            formatter={(value) => [
                                formatter(value),
                                label,
                            ]}
                            labelFormatter={(value) => `Kilometre ${value}`}
                        />
                        <Line
                            type="monotone"
                            dataKey={dataKey}
                            stroke="#fc4c02"
                            strokeWidth={2}
                            dot={{ r: 4 }}
                            connectNulls
                            />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

export default ActivityMetricChart;