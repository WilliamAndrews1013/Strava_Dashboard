import { useEffect, useState } from "react";
import { getActivities, getActivityDetails } from "../api/activities";

import ActivityList from "./ActivityList";
import ActivityDetails from "./ActivityDetails";
import ActivityMap from "./ActivityMap";
import ActivityMetricChart from "./ActivityMetricChart";
import "./ActivitiesPage.css"


function ActivitiesPage() {
    const [activities, setActivities] = useState([]);
    const [selectedActivity, setSelectedActivity] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        getActivities()
            .then((data) => {
                setActivities(data);
            })
            .catch((err) => {
                console.error(err);
                setError("Failed to load activities");
            })
            .finally(() => {
                setLoading(false);
            });
    }, []);

    if (loading) {
        return <p>Loading activities...</p>;
    }

    if (error) {
        return <p>{error}</p>
    }

    const mapActivities = selectedActivity ? [selectedActivity] : activities;
    

    async function handleSelectActivity(activity) {
        // Select immediately so map/table respond instantly
        setSelectedActivity(activity);

        try {
            const rawPayload = await getActivityDetails(activity.activity_id);

            setSelectedActivity((current) => {
                if (current?.activity_id !== activity.activity_id) {
                    return current;
                }

                return {...current, raw_payload: rawPayload};
            });

            setActivities((currentActivities) =>
                currentActivities.map((item) =>
                    item.activity_id === activity.activity_id ? {...item, raw_payload: rawPayload} : item
                )
            );
        } catch (error) {
            console.error("Failed to fetch activity details:", error);
        }
    }

    return (
        <div className="activities-page">
            <div className="activities-left">
                <div className="map-container">
                    <ActivityMap activities={mapActivities} />
                </div>

                <div className="table-container">
                    <ActivityList
                        activities={activities}
                        selectedActivity={selectedActivity}
                        onSelectActivity={handleSelectActivity}
                    />
                </div>
            </div>

            <div className="activities-right">
                <ActivityDetails activity={selectedActivity} />
                <ActivityMetricChart activity={selectedActivity} />
            </div>
        </div>
    );
}

export default ActivitiesPage;