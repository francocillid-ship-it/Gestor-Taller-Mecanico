
import React, { useState, useEffect } from 'react';
import type { Gasto } from '../types';
import { XMarkIcon, PlusCircleIcon, DocumentArrowUpIcon, ArrowPathIcon } from '@heroicons/react/24/solid';
import { recognizeGastoDataFromFile } from '../gemini';

interface AddGastoModalProps {
    onClose: () => void;
    onAddGasto: (gastos: Omit<Gasto, 'id'>[]) => Promise<void>;
}

const CATEGORIAS_GASTO = [
    { id: 'Sueldos', label: 'Sueldos/Planilla' },
    { id: 'Alquiler', label: 'Alquiler/Taller' },
    { id: 'Impuestos', label: 'Impuestos/Tasas' },
    { id: 'Servicios', label: 'Servicios (Luz/Agua)' },
    { id: 'Repuestos', label: 'Repuestos/Insumos' },
    { id: 'Herramientas', label: 'Inversión Herramientas' },
    { id: 'Marketing', label: 'Marketing/Publicidad' },
    { id: 'Otros', label: 'Otros Gastos' },
];

const AddGastoModal: React.FC<AddGastoModalProps> = ({ onClose, onAddGasto }) => {
    const [descripcion, setDescripcion] = useState('');
    const [monto, setMonto] = useState('');
    const [categoria, setCategoria] = useState('Otros');
    const [esFijo, setEsFijo] = useState(false);
    const [isRecurring, setIsRecurring] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    useEffect(() => {
        // Un pequeño delay para asegurar el montaje antes de la transición
        const timer = setTimeout(() => setIsVisible(true), 10);
        return () => clearTimeout(timer);
    }, []);

    const handleClose = () => {
        setIsVisible(false);
        setTimeout(onClose, 300);
    };

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

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsProcessing(true);
        try {
            const reader = new FileReader();
            reader.onload = async (event) => {
                const base64 = (event.target?.result as string).split(',')[1];
                const data = await recognizeGastoDataFromFile(base64, file.type);

                if (data.descripcion) setDescripcion(data.descripcion);
                if (data.monto) {
                    const formattedValue = new Intl.NumberFormat('es-AR', {
                        style: 'currency',
                        currency: 'ARS'
                    }).format(data.monto);
                    setMonto(formattedValue);
                }
                if (data.categoria) setCategoria(data.categoria);
                if (data.esFijo !== undefined) setEsFijo(data.esFijo);
            };
            reader.readAsDataURL(file);
        } catch (error) {
            console.error("Error processing file:", error);
            alert("No se pudo procesar el archivo. Inténtalo de nuevo o cárgalo manualmente.");
        } finally {
            setIsProcessing(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
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
                        fecha: gastoDate.toISOString(),
                        categoria,
                        esFijo
                    });
                }
            } else {
                gastosToAdd.push({
                    descripcion,
                    monto: numericValue,
                    fecha: new Date().toISOString(),
                    categoria,
                    esFijo
                });
            }

            await onAddGasto(gastosToAdd);
            handleClose();
        }
    };

    return (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 sm:p-0">
            <div
                className={`fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ease-out ${isVisible ? 'opacity-100' : 'opacity-0'}`}
                onClick={handleClose}
            />
            <div
                className={`bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 w-full max-w-md relative z-10 transform transition-all duration-300 ease-out border border-white/10 ${isVisible ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-4 sm:translate-y-0'}`}
            >
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-taller-dark dark:text-taller-light flex items-center">
                        <div className="p-2 bg-taller-primary/10 rounded-lg mr-3">
                            <PlusCircleIcon className="h-6 w-6 text-taller-primary" />
                        </div>
                        Nuevo Gasto
                    </h2>
                    <div className="flex items-center space-x-2">
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileSelect}
                            accept="application/pdf,image/*"
                            className="hidden"
                        />
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isProcessing}
                            className={`p-2 rounded-xl transition-all flex items-center space-x-2 text-xs font-bold ${isProcessing ? 'bg-gray-100 text-gray-400' : 'bg-taller-primary/10 text-taller-primary hover:bg-taller-primary hover:text-white border border-taller-primary/20'}`}
                            title="Subir factura o recibo"
                        >
                            {isProcessing ? (
                                <ArrowPathIcon className="h-5 w-5 animate-spin" />
                            ) : (
                                <DocumentArrowUpIcon className="h-5 w-5" />
                            )}
                            <span className="hidden sm:inline">IA Extraer</span>
                        </button>
                        <button onClick={handleClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-taller-gray dark:text-gray-400 transition-colors">
                            <XMarkIcon className="h-6 w-6" />
                        </button>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label htmlFor="descripcion" className="block text-xs font-bold text-taller-gray dark:text-gray-400 uppercase tracking-wider mb-1">Descripción</label>
                        <input
                            type="text"
                            id="descripcion"
                            value={descripcion}
                            onChange={e => setDescripcion(e.target.value)}
                            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-taller-primary focus:border-transparent text-taller-dark dark:text-taller-light transition-all outline-none"
                            placeholder="Ej: Alquiler Febrero"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="monto" className="block text-xs font-bold text-taller-gray dark:text-gray-400 uppercase tracking-wider mb-1">Monto</label>
                            <input
                                type="text"
                                inputMode="decimal"
                                id="monto"
                                value={monto}
                                onChange={handleMontoChange}
                                placeholder="$ 0,00"
                                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-taller-primary focus:border-transparent text-taller-dark dark:text-taller-light font-mono"
                                required
                            />
                        </div>
                        <div>
                            <label htmlFor="categoria" className="block text-xs font-bold text-taller-gray dark:text-gray-400 uppercase tracking-wider mb-1">Categoría</label>
                            <select
                                id="categoria"
                                value={categoria}
                                onChange={e => setCategoria(e.target.value)}
                                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-taller-primary focus:border-transparent text-taller-dark dark:text-taller-light outline-none appearance-none"
                            >
                                {CATEGORIAS_GASTO.map(cat => (
                                    <option key={cat.id} value={cat.id}>{cat.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl space-y-3">
                        <label className="flex items-center group cursor-pointer">
                            <div className="relative">
                                <input
                                    type="checkbox"
                                    checked={esFijo}
                                    onChange={(e) => setEsFijo(e.target.checked)}
                                    className="sr-only"
                                />
                                <div className={`w-10 h-5 rounded-full transition-colors duration-200 ${esFijo ? 'bg-taller-primary' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
                                <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform duration-200 ${esFijo ? 'translate-x-5' : 'translate-x-0'}`}></div>
                            </div>
                            <span className="ml-3 text-sm font-medium text-taller-dark dark:text-taller-light">Es un Gasto Fijo</span>
                        </label>

                        <label className="flex items-center group cursor-pointer">
                            <div className="relative">
                                <input
                                    type="checkbox"
                                    checked={isRecurring}
                                    onChange={(e) => setIsRecurring(e.target.checked)}
                                    className="sr-only"
                                />
                                <div className={`w-10 h-5 rounded-full transition-colors duration-200 ${isRecurring ? 'bg-taller-primary' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
                                <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform duration-200 ${isRecurring ? 'translate-x-5' : 'translate-x-0'}`}></div>
                            </div>
                            <span className="ml-3 text-sm font-medium text-taller-dark dark:text-taller-light">Repetir para todo el año</span>
                        </label>
                    </div>

                    <div className="pt-2 flex flex-col sm:flex-row gap-3">
                        <button
                            type="button"
                            onClick={handleClose}
                            className="flex-1 py-3 px-4 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 py-3 px-4 bg-taller-primary hover:bg-taller-secondary text-white rounded-xl text-sm font-bold shadow-lg shadow-taller-primary/20 transition-all active:scale-[0.98] disabled:opacity-50"
                        >
                            {isSubmitting ? 'Procesando...' : 'Añadir Gasto'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddGastoModal;
