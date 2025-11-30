import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import type { Vehiculo, MaintenanceConfig } from '../types';
import { XMarkIcon, CheckCircleIcon, WrenchIcon } from '@heroicons/react/24/solid';

interface MaintenanceConfigModalProps {
    vehiculo: Vehiculo;
    onClose: () => void;
    onSuccess: () => void;
}

// Configuración por defecto para inicializar el estado si no existe config previa
const DEFAULT_CONFIG_MAP = [
    { category: 'Fluidos', key: 'oil', label: 'Aceite de Motor', defaultMonths: 12, defaultMileage: 10000 },
    { category: 'Fluidos', key: 'transmission_fluid', label: 'Aceite Transmisión', defaultMonths: 48, defaultMileage: 60000 },
    { category: 'Fluidos', key: 'coolant', label: 'Líquido Refrigerante', defaultMonths: 24, defaultMileage: 40000 },
    { category: 'Filtros', key: 'oil_filter', label: 'Filtro de Aceite', defaultMonths: 12, defaultMileage: 10000 },
    { category: 'Filtros', key: 'air_filter', label: 'Filtro de Aire', defaultMonths: 12, defaultMileage: 15000 },
    { category: 'Filtros', key: 'fuel_filter', label: 'Filtro de Combustible', defaultMonths: 12, defaultMileage: 15000 },
    { category: 'Filtros', key: 'cabin_filter', label: 'Filtro de Habitáculo', defaultMonths: 12, defaultMileage: 15000 },
    { category: 'Otros', key: 'timing_belt', label: 'Kit de Distribución', defaultMonths: 60, defaultMileage: 60000 },
    { category: 'Otros', key: 'brakes', label: 'Revisión de Frenos', defaultMonths: 12, defaultMileage: 20000 },
];

const MaintenanceConfigModal: React.FC<MaintenanceConfigModalProps> = ({ vehiculo, onClose, onSuccess }) => {
    const [config, setConfig] = useState<MaintenanceConfig>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        // Cargar configuración existente o inicializar con valores por defecto
        const initialConfig: MaintenanceConfig = {};
        
        DEFAULT_CONFIG_MAP.forEach(item => {
            if (vehiculo.maintenance_config && vehiculo.maintenance_config[item.key]) {
                initialConfig[item.key] = vehiculo.maintenance_config[item.key];
            } else {
                initialConfig[item.key] = {
                    months: item.defaultMonths,
                    mileage: item.defaultMileage,
                    enabled: true
                };
            }
        });
        setConfig(initialConfig);
    }, [vehiculo]);

    const handleChange = (key: string, field: 'months' | 'mileage', value: string) => {
        const numValue = parseInt(value) || 0;
        setConfig(prev => ({
            ...prev,
            [key]: {
                ...prev[key],
                [field]: numValue
            }
        }));
    };

    const handleToggle = (key: string) => {
        setConfig(prev => ({
            ...prev,
            [key]: {
                ...prev[key],
                enabled: !prev[key].enabled
            }
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        
        try {
            const { error } = await supabase
                .from('vehiculos')
                .update({ maintenance_config: config })
                .eq('id', vehiculo.id);

            if (error) throw error;
            onSuccess();
        } catch (error) {
            console.error("Error saving maintenance config:", error);
            alert("Error al guardar la configuración.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Agrupar items por categoría para renderizar
    const groupedItems = DEFAULT_CONFIG_MAP.reduce((acc, item) => {
        if (!acc[item.category]) acc[item.category] = [];
        acc[item.category].push(item);
        return acc;
    }, {} as Record<string, typeof DEFAULT_CONFIG_MAP>);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
                    <div>
                        <h2 className="text-xl font-bold text-taller-dark dark:text-taller-light">Configurar Mantenimiento</h2>
                        <p className="text-sm text-taller-gray dark:text-gray-400">{vehiculo.marca} {vehiculo.modelo} ({vehiculo.matricula})</p>
                    </div>
                    <button onClick={onClose} className="text-taller-gray dark:text-gray-400 hover:text-taller-dark dark:hover:text-white">
                        <XMarkIcon className="h-6 w-6" />
                    </button>
                </div>
                
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-6">
                    {Object.entries(groupedItems).map(([category, items]) => (
                        <div key={category} className="border dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-700/30">
                            <h3 className="font-bold text-taller-primary mb-3 uppercase text-xs tracking-wider">{category}</h3>
                            <div className="space-y-4">
                                {items.map(item => {
                                    const itemConfig = config[item.key] || { months: item.defaultMonths, mileage: item.defaultMileage, enabled: true };
                                    return (
                                        <div key={item.key} className={`grid grid-cols-1 sm:grid-cols-12 gap-4 items-center ${!itemConfig.enabled ? 'opacity-50' : ''}`}>
                                            <div className="sm:col-span-4 flex items-center gap-2">
                                                <input 
                                                    type="checkbox"
                                                    checked={itemConfig.enabled}
                                                    onChange={() => handleToggle(item.key)}
                                                    className="h-4 w-4 text-taller-primary rounded border-gray-300 focus:ring-taller-primary"
                                                />
                                                <span className="font-medium text-sm text-taller-dark dark:text-taller-light">{item.label}</span>
                                            </div>
                                            <div className="sm:col-span-4">
                                                <label className="block text-xs text-taller-gray dark:text-gray-400 mb-1">Intervalo KM</label>
                                                <div className="relative">
                                                    <input 
                                                        type="number"
                                                        value={itemConfig.mileage}
                                                        onChange={(e) => handleChange(item.key, 'mileage', e.target.value)}
                                                        disabled={!itemConfig.enabled}
                                                        className="block w-full px-2 py-1.5 text-sm bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md focus:outline-none focus:ring-1 focus:ring-taller-primary"
                                                    />
                                                    <span className="absolute right-2 top-1.5 text-xs text-gray-500">km</span>
                                                </div>
                                            </div>
                                            <div className="sm:col-span-4">
                                                <label className="block text-xs text-taller-gray dark:text-gray-400 mb-1">Intervalo Tiempo</label>
                                                <div className="relative">
                                                    <input 
                                                        type="number"
                                                        value={itemConfig.months}
                                                        onChange={(e) => handleChange(item.key, 'months', e.target.value)}
                                                        disabled={!itemConfig.enabled}
                                                        className="block w-full px-2 py-1.5 text-sm bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md focus:outline-none focus:ring-1 focus:ring-taller-primary"
                                                    />
                                                    <span className="absolute right-2 top-1.5 text-xs text-gray-500">meses</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </form>

                <div className="p-4 border-t dark:border-gray-700 flex justify-end gap-3 bg-white dark:bg-gray-800 rounded-b-lg">
                    <button 
                        type="button" 
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="px-4 py-2 text-sm font-medium text-white bg-taller-primary border border-transparent rounded-md shadow-sm hover:bg-taller-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-taller-primary disabled:opacity-50"
                    >
                        {isSubmitting ? 'Guardando...' : 'Guardar Configuración'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MaintenanceConfigModal;
