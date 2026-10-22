import StatCard from "./StatCard";
import "./ActivityDetails.css";

function formatDuration(seconds) {
    if (!seconds) {
        return "-";
    }

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor(
        (seconds % 3600) / 60
    );
    const remainingSeconds = seconds % 60;

    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, "0")}:${String(
            remainingSeconds
        ).padStart(2, "0")}`;
    }

    return `${minutes}:${String(
        remainingSeconds
    ).padStart(2, "0")}`;
}

function calculatePace(metersPerSecond) {
    if (!metersPerSecond) {
        return "-";
    }

    const secondsPerKm =
        1000 / metersPerSecond;

    const minutes = Math.floor(
        secondsPerKm / 60
    );

    const seconds = Math.round(
        secondsPerKm % 60
    );

    return `${minutes}:${String(seconds).padStart(2, "0")}`;
}


function ActivityDetails({ activity }) {
    if (!activity) {
        return (
            <div className="no-activity">
                Select an activity to view its detials
            </div>
        );
    }

    const distanceKm = activity.distance_meters != null ? (activity.distance_meters / 1000).toFixed(2) : "-";

    const elevation = activity.total_elevation_gain ?? "-";

    const movingTime = formatDuration(activity.moving_time_seconds);

    const averageHeartRate = activity.raw_payload?.average_heartrate ?? "-";

    const maxHeartRate = activity.raw_payload?.max_heartrate ?? "-";

    const calories = activity.raw_payload?.calories ?? "-"

    const averageSpeed = activity.raw_payload?.average_speed;

    const pace = calculatePace(averageSpeed);

    return (
        <div>
            <div className="activity-heading">
                <h2>{activity.name}</h2>
                <span>{activity.activity_type}</span>
            </div>

            <div className="stats-grid">
                <StatCard
                    title="Distance"
                    value={distanceKm}
                    unit="km"
                />

                <StatCard
                    title="Moving Time"
                    value={movingTime}
                />

                <StatCard
                    title="Average Pace"
                    value={pace}
                    unit="km"
                />

                <StatCard
                    title="Elevation"
                    value={elevation}
                    unit="m"
                />

                <StatCard
                    title="Avg Heart Rate"
                    value={averageHeartRate}
                    unit="bpm"
                />

                <StatCard
                    title="Max Heart Rate"
                    value={maxHeartRate}
                    unit="bpm"
                />

                <StatCard
                    title="Calories"
                    value={calories}
                    unit="kcal"
                />
            </div>
        </div>
    );
}

export default ActivityDetails;