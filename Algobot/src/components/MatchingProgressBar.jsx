
import { useState, useEffect } from 'react';
import { importAPI } from '../services/api';

const MatchingProgressBar = () => {
    const [status, setStatus] = useState(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        let timer;
        const checkStatus = async () => {
            try {
                const response = await importAPI.getMatchingProgress();
                const data = response.data;

                if (data) {
                    setStatus(data);

                    // Show if running OR if we have processed something recently
                    if (data.is_running || (data.processed > 0 && data.processed < data.total)) {
                        setVisible(true);
                    }
                    // If finished, wait 10 seconds before hiding
                    else if (!data.is_running && data.processed >= data.total && data.total > 0) {
                        setVisible(true);
                        if (!timer) {
                            timer = setTimeout(() => setVisible(false), 10000);
                        }
                    } else {
                        setVisible(false);
                    }
                }
            } catch (err) {
                console.error("Error polling matching status:", err);
            }
        };

        checkStatus();
        const interval = setInterval(checkStatus, 2000);

        return () => {
            clearInterval(interval);
            if (timer) clearTimeout(timer);
        };
    }, []);

    if (!visible || !status) return null;

    const percentage = status.total > 0 ? Math.round((status.processed / status.total) * 100) : 0;

    // Aesthetic computation
    let colorClass = "bg-blue-600";
    if (status.is_running) colorClass = "bg-blue-600 animate-pulse";
    if (!status.is_running && percentage === 100) colorClass = "bg-green-500";

    return (
        <div className="w-full mb-6 p-4 bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-2">
                <div>
                    <h3 className="text-sm font-semibold text-gray-700">
                        {status.is_running ? 'AI Product Matching in Progress...' : 'Matching Completed'}
                    </h3>
                    <p className="text-xs text-gray-500">
                        {status.current_product || 'Initializing...'}
                    </p>
                </div>
                <div className="text-right">
                    <span className="text-2xl font-bold text-gray-800">{percentage}%</span>
                    <p className="text-xs text-gray-500">
                        {status.matched} matched / {status.processed} processed
                    </p>
                </div>
            </div>

            <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                <div
                    className={`h-2.5 rounded-full transition-all duration-500 ease-out ${colorClass}`}
                    style={{ width: `${percentage}%` }}
                ></div>
            </div>

            <div className="flex justify-between mt-2 text-xs text-gray-400">
                <span>Total: {status.total} products</span>
                <span>Errors: {status.errors}</span>
            </div>
        </div>
    );
};

export default MatchingProgressBar;
