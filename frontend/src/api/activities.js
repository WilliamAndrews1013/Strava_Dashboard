import axios from 'axios'
const API_URL = import.meta.env.VITE_API_URL

export async function getActivities() {
    try {
        const response = await axios.get(
            `${API_URL}/detailed_activities`
        );
        return response.data;
    } catch (error) {
        console.error("API ERRPR:", error.response?.status, error.response?.data || error.message);
        
        throw error;
    }
}

export async function getActivityDetails(activityId) {
    try {
        const response = await axios.get(
            `${API_URL}/activities/${activityId}`
        );
        return response.data.activity_data;
    } catch (error) {
        console.error("API ERRPR:", error.response?.status, error.response?.data || error.message);
        
        throw error;
    }
}

export async function getActivityMetrics(activityId) {
    try {
        const response = await axios.get(
            `${API_URL}/activities/${activityId}/metrics`
        );
        return response.data.splits;
    } catch (error) {
        console.error("API ERROR:", error.response?.status, error.message.response?.data || error.message);

        throw error;
    }
}