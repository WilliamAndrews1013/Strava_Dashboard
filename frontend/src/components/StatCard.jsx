function StatCard({ title, value, unit }) {
    return (
        <div className="stat-card">
            <span className="stat-title">{title}</span>

            <div className="stat-value">
                 {value}
                 {unit && (
                    <span className="stat-unit">
                        {unit}
                    </span>
                 )}
            </div>
        </div>
    );
}

export default StatCard