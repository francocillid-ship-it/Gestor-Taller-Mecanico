import React, { useState } from 'react';
import type { Gasto } from '../types';
import { XMarkIcon, PlusCircleIcon } from '@heroicons/react/24/solid';

interface AddGastoModalProps {
    onClose: () => void;
    onAddGasto: (gastos: Omit<Gasto, 'id'>[]) => Promise<void>;
}

const AddGastoModal: React.FC<AddGastoModalProps> = ({ onClose, onAddGasto }) => {
    const [descripcion, setDescripcion] = useState('');
    const [monto, setMonto] = useState('');
    const [isRecurring, setIsRecurring] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleMontoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value;
        const digits = rawValue.replace(/\D/g, '');

        if (digits === '') {
            setMonto('');
            return;
        }
        
        const numberValue = parseInt(digits, 10);
        
        const formattedValue = new Intl.NumberFormat('es-AR', { 
            style: 'currency', 
            currency: 'ARS'
        }).format(numberValue / 100);

        setMonto(formattedValue);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (descripcion && monto && !isSubmitting) {
            setIsSubmitting(true);
            
            const digits = monto.replace(/\D/g, '');
            const numericValue = parseInt(digits, 10) / 100;

            const gastosToAdd: Omit<Gasto, 'id'>[] = [];

            if (isRecurring) {
                const today = new Date();
                const day = today.getDate();
                const currentMonth = today.getMonth();
                const currentYear = today.getFullYear();

                for (let month = currentMonth; month < 12; month++) {
                    const lastDayOfMonth = new Date(currentYear, month + 1, 0).getDate();
                    const dayForGasto = Math.min(day, lastDayOfMonth);
                    const gastoDate = new Date(currentYear, month, dayForGasto);
                    
                    gastosToAdd.push({ 
                        descripcion: `${descripcion} (${gastoDate.toLocaleString('es-ES', { month: 'long' })})`, 
                        monto: numericValue,
                        fecha: gastoDate.toISOString()
                    });
                }
            } else {
                gastosToAdd.push({ 
                    descripcion, 
                    monto: numericValue,
                    fecha: new Date().toISOString()
                });
            }
            
            await onAddGasto(gastosToAdd);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-taller-dark dark:text-taller-light flex items-center">
                        <PlusCircleIcon className="h-6 w-6 mr-2 text-taller-primary"/>
                        Añadir Gasto
                    </h2>
                    <button onClick={onClose} className="text-taller-gray dark:text-gray-400 hover:text-taller-dark dark:hover:text-white"><XMarkIcon className="h-6 w-6" /></button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="descripcion" className="block text-sm font-medium text-taller-gray dark:text-gray-400">Descripción</label>
                        <input 
                            type="text" 
                            id="descripcion" 
                            value={descripcion} 
                            onChange={e => setDescripcion(e.target.value)} 
                            className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-taller-primary focus:border-taller-primary text-taller-dark dark:text-taller-light sm:text-sm" 
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="monto" className="block text-sm font-medium text-taller-gray dark:text-gray-400">Monto</label>
                        <input 
                            type="text"
                            inputMode="decimal"
                            id="monto" 
                            value={monto} 
                            onChange={handleMontoChange} 
                            placeholder="$ 0,00"
                            className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-taller-primary focus:border-taller-primary text-taller-dark dark:text-taller-light sm:text-sm" 
                            required
                        />
                    </div>
                    <div className="flex items-center">
                        <input
                            id="recurring"
                            name="recurring"
                            type="checkbox"
                            checked={isRecurring}
                            onChange={(e) => setIsRecurring(e.target.checked)}
                            className="h-4 w-4 text-taller-primary focus:ring-taller-primary border-gray-300 dark:border-gray-600 rounded"
                        />
                        <label htmlFor="recurring" className="ml-2 block text-sm text-taller-gray dark:text-gray-400">
                            Gasto mensual recurrente
                        </label>
                    </div>
                    <div className="pt-4 flex justify-end space-x-3">
                        <button type="button" onClick={onClose} className="py-2 px-4 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                            Cancelar
                        </button>
                        <button type="submit" disabled={isSubmitting} className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-taller-primary hover:bg-taller-secondary disabled:opacity-50">
                            {isSubmitting ? 'Añadiendo...' : 'Añadir Gasto'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddGastoModal;