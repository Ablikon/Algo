import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const CityContext = createContext();

export function CityProvider({ children }) {
    const [cities, setCities] = useState([]);
    const [currentCity, setCurrentCity] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchCities();
    }, []);

    const fetchCities = async () => {
        try {
            const response = await api.get('/cities/');
            setCities(response.data);
            if (response.data.length > 0) {
                // Try to recover from localStorage or default to first
                const savedCitySlug = localStorage.getItem('selectedCity');
                const found = response.data.find(c => c.slug === savedCitySlug);
                if (found) {
                    setCurrentCity(found);
                } else {
                    setCurrentCity(response.data[0]);
                }
            }
        } catch (error) {
            console.error('Failed to fetch cities:', error);
        } finally {
            setLoading(false);
        }
    };

    const selectCity = (city) => {
        setCurrentCity(city);
        localStorage.setItem('selectedCity', city.slug);
        // Reload validation or create a reload mechanism?
        // Usually changing context triggers re-renders which should re-fetch data if they depend on context
        window.location.reload(); // Simple brute force update for now to ensure all queries refresh with new city
    };

    return (
        <CityContext.Provider value={{ cities, currentCity, selectCity, loading }}>
            {children}
        </CityContext.Provider>
    );
}

export function useCity() {
    return useContext(CityContext);
}
