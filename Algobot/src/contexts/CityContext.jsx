import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const CityContext = createContext();

export function CityProvider({ children }) {
    const [cities, setCities] = useState([]);
    const [currentCity, setCurrentCity] = useState(null);
    const [loading, setLoading] = useState(true);
    // refreshKey is used to trigger data refresh in components when city changes
    const [refreshKey, setRefreshKey] = useState(0);

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
                    localStorage.setItem('selectedCity', response.data[0].slug);
                }
            }
        } catch (error) {
            console.error('Failed to fetch cities:', error);
        } finally {
            setLoading(false);
        }
    };

    const selectCity = useCallback((city) => {
        setCurrentCity(city);
        localStorage.setItem('selectedCity', city.slug);
        // Increment refreshKey to trigger data refresh in all components
        // that depend on city without full page reload
        setRefreshKey(prev => prev + 1);
    }, []);

    return (
        <CityContext.Provider value={{ cities, currentCity, selectCity, loading, refreshKey }}>
            {children}
        </CityContext.Provider>
    );
}

export function useCity() {
    return useContext(CityContext);
}
