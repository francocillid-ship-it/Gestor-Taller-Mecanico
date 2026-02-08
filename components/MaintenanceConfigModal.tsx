
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../supabaseClient';
import type { Vehiculo, MaintenanceConfig } from '../types';
import { XMarkIcon } from '@heroicons/react/24/solid';

interface MaintenanceConfigModalProps {
    vehiculo: Vehiculo;
    onClose: () => void;
    onSuccess: () => void;
}

// Tipo local para permitir edición flexible (strings vacíos) en el formulario
interface LocalMaintenanceItem {
    months: number | string;
    mileage: number | string;
    enabled: boolean;
}

interface LocalMaintenanceConfig {
    [key: string]: LocalMaintenanceItem;
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
    // Usamos LocalMaintenanceConfig para permitir strings vacíos durante la edición
    const [config, setConfig] = useState<LocalMaintenanceConfig>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Cargar configuración existente o inicializar con valores por defecto
        const initialConfig: LocalMaintenanceConfig = {};

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
        requestAnimationFrame(() => setIsVisible(true));
    }, [vehiculo]);

    const handleClose = () => {
        setIsVisible(false);
        setTimeout(onClose, 300);
    };

    const handleChange = (key: string, field: 'months' | 'mileage', value: string) => {
        // Permitimos string vacío para mejor UX al borrar
        const newValue = value === '' ? '' : parseInt(value, 10);

        setConfig(prev => ({
            ...prev,
            [key]: {
                ...prev[key],
                [field]: newValue // Si es NaN o '' se guarda tal cual para la UI
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
            // Preparamos la configuración final asegurando que sean números para la DB
            const finalConfig: MaintenanceConfig = {};

            Object.entries(config).forEach(([key, val]) => {
                const item = val as LocalMaintenanceItem;
                finalConfig[key] = {
                    enabled: item.enabled,
                    months: item.months === '' ? 0 : Number(item.months),
                    mileage: item.mileage === '' ? 0 : Number(item.mileage)
                };
            });

            const { error } = await supabase
                .from('vehiculos')
                .update({ maintenance_config: finalConfig })
                .eq('id', vehiculo.id);

            if (error) throw error;
            setIsVisible(false);
            setTimeout(() => onSuccess(), 300);
        } catch (error) {
            console.error("Error saving maintenance config:", error);
            alert("Error al guardar la configuración.");
            setIsSubmitting(false);
        }
    };

    // Agrupar items por categoría para renderizar
    const groupedItems = DEFAULT_CONFIG_MAP.reduce((acc, item) => {
        if (!acc[item.category]) acc[item.category] = [];
        acc[item.category].push(item);
        return acc;
    }, {} as Record<string, typeof DEFAULT_CONFIG_MAP>);

    const submitForm = () => {
        const form = document.getElementById('maintenance-form') as HTMLFormElement;
        if (form) {
            if (form.requestSubmit) form.requestSubmit();
            else form.submit();
        }
    };

    const modalContent = (
        <div className="fixed inset-0 z-[100] flex justify-center items-end sm:items-center sm:p-4">
            <div
                className={`fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ease-out ${isVisible ? 'opacity-100' : 'opacity-0'}`}
                onClick={handleClose}
            />
            <div
                className={`bg-white dark:bg-gray-800 w-full h-[100dvh] sm:h-auto sm:max-h-[90vh] sm:max-w-2xl sm:rounded-xl shadow-2xl flex flex-col overflow-hidden relative z-10 transform transition-all duration-300 ease-out ${isVisible ? 'translate-y-0 opacity-100 sm:scale-100' : 'translate-y-full opacity-0 sm:translate-y-0 sm:scale-95'}`}
            >
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-taller-dark dark:text-taller-light">Configurar Mantenimiento</h2>
                        <p className="text-sm text-taller-gray dark:text-gray-400">{vehiculo.marca} {vehiculo.modelo} ({vehiculo.matricula})</p>
                    </div>
                    <button onClick={handleClose} className="p-2 -mr-2 text-taller-gray dark:text-gray-400 hover:text-taller-dark dark:hover:text-white rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                        <XMarkIcon className="h-6 w-6" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6 overscroll-contain">
                    <form id="maintenance-form" onSubmit={handleSubmit} className="space-y-6 pb-24 sm:pb-0">
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
                                                            className="block w-full px-2 py-1.5 text-sm bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md focus:outline-none focus:ring-1 focus:ring-taller-primary no-spinner"
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
                                                            className="block w-full px-2 py-1.5 text-sm bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md focus:outline-none focus:ring-1 focus:ring-taller-primary no-spinner"
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
                </div>

                {/* Footer */}
                <div className="border-t dark:border-gray-700 p-4 bg-white dark:bg-gray-800 flex gap-3 shrink-0 z-10 safe-area-bottom">
                    <button type="button" onClick={handleClose} className="flex-1 justify-center py-3 px-4 border border-gray-300 dark:border-gray-500 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">
                        Cancelar
                    </button>
                    <button type="button" onClick={submitForm} disabled={isSubmitting} className="flex-[2] justify-center py-3 px-6 border border-transparent rounded-xl shadow-lg shadow-taller-primary/30 text-sm font-bold text-white bg-taller-primary hover:bg-taller-secondary disabled:opacity-50 disabled:shadow-none transition-all active:scale-95">
                        {isSubmitting ? 'Guardando...' : 'Guardar Configuración'}
                    </button>
                </div>
            </div>
        </div>
    );

    return createPortal(
        <>
            {modalContent}
            <style>{`
                .no-spinner::-webkit-inner-spin-button,
                .no-spinner::-webkit-outer-spin-button {
                    -webkit-appearance: none;
                    margin: 0;
                }
                .no-spinner {
                    -moz-appearance: textfield;
                }
                .safe-area-bottom {
                    padding-bottom: var(--safe-bottom);
                }
                @media (min-width: 640px) {
                    .safe-area-bottom {
                        padding-bottom: 1rem;
                    }
                }
            `}</style>
        </>,
        document.body
    );
};

export default MaintenanceConfigModal;
