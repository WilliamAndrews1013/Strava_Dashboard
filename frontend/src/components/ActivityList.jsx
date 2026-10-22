import "./ActivityList.css"

function formatDuration(seconds) {
    if (!seconds) return "-";

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }

    return `${minutes}m`;
}

function formatDate(date) {
    if (!date) return "-";

    return new Date(date).toLocaleDateString();
}

function ActivityList({activities, selectedActivity, onSelectActivity}) {
    return (
        <div className="activity-table-scroll">
            <table className="activity-table">
                <thead>
                    <tr>
                        <th></th>
                        <th>Name</th>
                        <th>Type</th>
                        <th>Distance</th>
                        <th>Time</th>
                        <th>Date</th>
                    </tr>
                </thead>

                <tbody>
                    {activities.map((activity) => {
                        const isSelected = selectedActivity?.activity_id === activity.activity_id;
                        return (
                            <tr 
                                key={activity.activity_id}
                                className={
                                    isSelected ? "selected" : ""
                                }
                                onClick={() =>
                                    onSelectActivity(activity)
                                }
                            >
                                <td>
                                    <input
                                        type="radio"
                                        name="selectedActivity"
                                        checked={isSelected}
                                        onChange={() => onSelectActivity(activity)}
                                    />
                                </td>
                                <td>{activity.name}</td>
                                <td>{activity.activity_type}</td>
                                <td>
                                    {(
                                        activity.distance_meters / 1000
                                    ).toFixed(2)}{" "}
                                    km
                                </td>
                                <td>
                                    {formatDuration(
                                        activity.moving_time_seconds
                                    )}
                                </td>
                                <td>
                                    {formatDate(
                                        activity.start_date_local
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

export default ActivityList;