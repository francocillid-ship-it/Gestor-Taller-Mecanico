import React, { useState } from 'react';
import { X, UserPlus, Phone, FileText } from 'lucide-react';
import { useSwipeToDismiss } from '../hooks/useSwipeToDismiss';
import type { EntidadFinanciera } from '../types';

interface AddEntidadModalProps {
    onClose: () => void;
    onAdd: (entidad: Omit<EntidadFinanciera, 'id' | 'taller_id' | 'saldo_actual'>) => void;
}

const AddEntidadModal: React.FC<AddEntidadModalProps> = ({ onClose, onAdd }) => {
    const [nombre, setNombre] = useState('');
    const [tipo, setTipo] = useState<'empleado' | 'proveedor'>('proveedor');
    const [telefono, setTelefono] = useState('');
    const [notas, setNotas] = useState('');

    const modalRef = React.useRef<HTMLDivElement>(null);
    const backdropRef = React.useRef<HTMLDivElement>(null);

    useSwipeToDismiss({
        onDismiss: onClose,
        modalRef,
        backdropRef,
        enabled: true
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!nombre.trim()) return;

        onAdd({
            nombre: nombre.trim(),
            tipo,
            telefono: telefono.trim() || undefined,
            notas: notas.trim() || undefined
        });

        onClose();
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-4">
            <div
                ref={backdropRef}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
                onClick={onClose}
            />

            <div
                ref={modalRef}
                className="w-full sm:max-w-md bg-taller-light dark:bg-taller-dark rounded-t-3xl sm:rounded-3xl shadow-2xl relative flex flex-col max-h-[90vh] transition-transform duration-300 animate-in slide-in-from-bottom sm:slide-in-from-bottom-8 sm:zoom-in-95"
            >
                {/* Handle for mobile swipe */}
                <div className="w-full h-1.5 flex justify-center mt-3 sm:hidden shrink-0">
                    <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full" />
                </div>

                <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-gray-800 shrink-0">
                    <div className="flex items-center space-x-3">
                        <div className="p-2.5 bg-taller-primary/10 rounded-2xl">
                            <UserPlus className="h-6 w-6 text-taller-primary" />
                        </div>
                        <h2 className="text-xl font-black text-taller-dark dark:text-taller-light tracking-tight">Nueva Entidad</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors shrink-0 outline-none focus:ring-2 focus:ring-taller-primary">
                        <X className="h-6 w-6 text-taller-gray" />
                    </button>
                </div>

                <div className="overflow-y-auto overscroll-none scrollbar-hide flex-1">
                    <form id="add-entidad-form" onSubmit={handleSubmit} className="p-6 space-y-6">

                        {/* Tipo de Entidad */}
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setTipo('proveedor')}
                                className={`flex items-center justify-center p-3 rounded-2xl border-2 transition-all ${tipo === 'proveedor' ? 'border-taller-primary bg-taller-primary/5 text-taller-primary' : 'border-gray-100 dark:border-gray-800 text-taller-gray hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                            >
                                <span className="text-sm font-bold">Proveedor</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setTipo('empleado')}
                                className={`flex items-center justify-center p-3 rounded-2xl border-2 transition-all ${tipo === 'empleado' ? 'border-taller-primary bg-taller-primary/5 text-taller-primary' : 'border-gray-100 dark:border-gray-800 text-taller-gray hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                            >
                                <span className="text-sm font-bold">Empleado</span>
                            </button>
                        </div>

                        <div>
                            <label className="block text-xs font-black text-taller-gray uppercase tracking-widest mb-2">Nombre *</label>
                            <input
                                required
                                value={nombre}
                                onChange={(e) => setNombre(e.target.value)}
                                className="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-taller-primary outline-none text-sm font-bold text-taller-dark dark:text-taller-light transition-all"
                                placeholder="Ej: Juan Perez, Repuestos AutoMax"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-black text-taller-gray uppercase tracking-widest mb-2 flex items-center gap-2">
                                <Phone className="w-3 h-3" /> Teléfono
                            </label>
                            <input
                                type="tel"
                                value={telefono}
                                onChange={(e) => setTelefono(e.target.value)}
                                className="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-taller-primary outline-none text-sm font-bold text-taller-dark dark:text-taller-light transition-all"
                                placeholder="Opcional"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-black text-taller-gray uppercase tracking-widest mb-2 flex items-center gap-2">
                                <FileText className="w-3 h-3" /> Notas / Detalles Adicionales
                            </label>
                            <textarea
                                value={notas}
                                onChange={(e) => setNotas(e.target.value)}
                                rows={2}
                                className="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-taller-primary outline-none text-sm font-medium text-taller-dark dark:text-taller-light transition-all resize-none"
                                placeholder="Opcional"
                            />
                        </div>

                    </form>
                </div>

                <div className="p-6 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 shrink-0 sm:rounded-b-3xl pb-safe">
                    <button
                        type="submit"
                        form="add-entidad-form"
                        disabled={!nombre.trim()}
                        className="w-full bg-taller-primary hover:bg-taller-secondary text-white py-4 rounded-2xl font-black text-base transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] shadow-lg shadow-taller-primary/20"
                    >
                        Guardar Entidad
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AddEntidadModal;
