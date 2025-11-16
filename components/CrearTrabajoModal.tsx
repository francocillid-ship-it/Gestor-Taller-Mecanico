import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import type { Cliente, Parte, Trabajo } from '../types';
import { JobStatus } from '../types';
import { XMarkIcon, PlusIcon, TrashIcon, UserPlusIcon } from '@heroicons/react/24/solid';
import CrearClienteModal from './CrearClienteModal';

interface CrearTrabajoModalProps {
    onClose: () => void;
    onSuccess: () => void;
    onDataRefresh: () => void;
    clientes: Cliente[];
    trabajoToEdit?: Trabajo;
}

type ParteState = {
    nombre: string;
    cantidad: number;
    precioUnitario: string; // Storing the formatted string
    isCategory?: boolean;
};


const CrearTrabajoModal: React.FC<CrearTrabajoModalProps> = ({ onClose, onSuccess, onDataRefresh, clientes, trabajoToEdit }) => {
    const [selectedClienteId, setSelectedClienteId] = useState('');
    const [selectedVehiculoId, setSelectedVehiculoId] = useState('');
    const [descripcion, setDescripcion] = useState('');
    const [partes, setPartes] = useState<ParteState[]>([]);
    const [costoManoDeObra, setCostoManoDeObra] = useState('');
    const [status, setStatus] = useState<JobStatus>(JobStatus.Presupuesto);
    const [pagos, setPagos] = useState<Parte[]>([]);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [error, setError] = useState('');
    const [isClientModalOpen, setIsClientModalOpen] = useState(false);
    const [confirmingDelete, setConfirmingDelete] = useState(false);

    const isEditMode = Boolean(trabajoToEdit);

    const formatCurrency = (value: string): string => {
        const digits = value.replace(/\D/g, '');
        if (digits === '') return '';
        const numberValue = parseInt(digits, 10);
        return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(numberValue / 100);
    };

    const parseCurrency = (value: string): number => {
        const digits = value.replace(/\D/g, '');
        if (digits === '') return 0;
        return parseInt(digits, 10) / 100;
    };
    
    const formatNumberToCurrency = (num: number | undefined) => {
        if (num === undefined || isNaN(num)) return '';
        return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(num);
    }
    
    const handleTextareaResize = (e: React.FormEvent<HTMLTextAreaElement>) => {
        const textarea = e.currentTarget;
        textarea.style.height = 'auto'; // Reset height to shrink if text is deleted
        textarea.style.height = `${textarea.scrollHeight}px`; // Set height to match content
    };

    useEffect(() => {
        if (trabajoToEdit) {
            setSelectedClienteId(trabajoToEdit.clienteId);
            setSelectedVehiculoId(trabajoToEdit.vehiculoId);
            setDescripcion(trabajoToEdit.descripcion);
            const initialPartes = trabajoToEdit.partes.filter(p => p.nombre !== '__PAGO_REGISTRADO__');
            setPartes(initialPartes.map(p => ({
                ...p,
                precioUnitario: formatNumberToCurrency(p.precioUnitario)
            })));
            setPagos(trabajoToEdit.partes.filter(p => p.nombre === '__PAGO_REGISTRADO__'));
            setCostoManoDeObra(formatNumberToCurrency(trabajoToEdit.costoManoDeObra));
            setStatus(trabajoToEdit.status);
        }
    }, [trabajoToEdit]);

    const selectedClientVehiculos = useMemo(() => {
        if (!selectedClienteId) return [];
        const cliente = clientes.find(c => c.id === selectedClienteId);
        return cliente?.vehiculos || [];
    }, [selectedClienteId, clientes]);
    
    useEffect(() => {
        if(selectedClienteId && !isEditMode) {
             const cliente = clientes.find(c => c.id === selectedClienteId);
             if (cliente && cliente.vehiculos.length === 1) {
                 setSelectedVehiculoId(cliente.vehiculos[0].id);
             } else {
                 setSelectedVehiculoId('');
             }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedClienteId, clientes]);

    const costoEstimado = useMemo(() => {
        const totalPartes = partes.filter(p => !p.isCategory).reduce((sum, p) => sum + (Number(p.cantidad) * parseCurrency(p.precioUnitario)), 0);
        return totalPartes + parseCurrency(costoManoDeObra);
    }, [partes, costoManoDeObra]);


    const handleParteChange = (index: number, field: keyof ParteState, value: string | number) => {
        const newPartes = [...partes];
        (newPartes[index] as any)[field] = value;
        setPartes(newPartes);
    };

    const addParte = () => {
        setPartes([...partes, { nombre: '', cantidad: 1, precioUnitario: '' }]);
    };
    
    const addCategory = () => {
        setPartes([...partes, { nombre: '', cantidad: 0, precioUnitario: '', isCategory: true }]);
    };


    const removeParte = (index: number) => {
        const newPartes = partes.filter((_, i) => i !== index);
        setPartes(newPartes);
    };
    
    const handleRemovePago = (indexToRemove: number) => {
        setPagos(currentPagos => currentPagos.filter((_, index) => index !== indexToRemove));
    };

    const handleDeleteJob = async () => {
        if (!trabajoToEdit) return;
        
        setIsDeleting(true);
        setError('');
        try {
            const { error: deleteError } = await supabase
                .from('trabajos')
                .delete()
                .eq('id', trabajoToEdit.id);

            if (deleteError) throw deleteError;

            onDataRefresh(); // Refresh data to update dashboard and other components
            onSuccess();
        } catch (err: any) {
            setError(err.message || 'Error al eliminar el trabajo.');
            console.error(err);
        } finally {
            setIsDeleting(false);
            setConfirmingDelete(false);
        }
    };


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedClienteId || !selectedVehiculoId) {
            setError('Por favor, seleccione un cliente y un vehículo.');
            return;
        }
        setIsSubmitting(true);
        setError('');

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("User not authenticated");

            const cleanPartes = partes
                .filter(p => p.nombre.trim() !== '')
                .map(p => ({
                    nombre: p.nombre,
                    cantidad: p.isCategory ? 0 : Number(p.cantidad),
                    precioUnitario: p.isCategory ? 0 : parseCurrency(p.precioUnitario),
                    isCategory: !!p.isCategory,
                }));
            
            const jobData = {
                cliente_id: selectedClienteId,
                vehiculo_id: selectedVehiculoId,
                taller_id: user.id,
                descripcion,
                partes: [...cleanPartes, ...pagos],
                costo_mano_de_obra: parseCurrency(costoManoDeObra),
                costo_estimado: costoEstimado,
                status: status,
                fecha_entrada: trabajoToEdit?.fechaEntrada || new Date().toISOString(),
            };

            if (isEditMode) {
                const { error: updateError } = await supabase
                    .from('trabajos')
                    .update(jobData)
                    .eq('id', trabajoToEdit!.id);
                if (updateError) throw updateError;
            } else {
                const { error: insertError } = await supabase
                    .from('trabajos')
                    .insert(jobData);
                if (insertError) throw insertError;
            }

            onSuccess();
        } catch (err: any) {
            setError(err.message || 'Error al guardar el trabajo.');
            console.error(err);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-taller-dark dark:text-taller-light">{isEditMode ? 'Editar Trabajo' : 'Crear Nuevo Presupuesto'}</h2>
                        <button onClick={onClose} className="text-taller-gray dark:text-gray-400 hover:text-taller-dark dark:hover:text-white"><XMarkIcon className="h-6 w-6" /></button>
                    </div>
                    <form onSubmit={handleSubmit} className="space-y-4 text-taller-dark dark:text-taller-light">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label htmlFor="cliente" className="block text-sm font-medium text-taller-gray dark:text-gray-400">Cliente</label>
                                     <button type="button" onClick={() => setIsClientModalOpen(true)} className="flex items-center gap-1 text-xs text-taller-primary font-medium hover:underline">
                                        <UserPlusIcon className="h-4 w-4"/> Nuevo Cliente
                                    </button>
                                </div>
                                <select id="cliente" value={selectedClienteId} onChange={e => setSelectedClienteId(e.target.value)} className="block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-taller-primary focus:border-taller-primary sm:text-sm" required>
                                    <option value="">Seleccione un cliente</option>
                                    {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                                </select>
                            </div>
                            <div>
                                <label htmlFor="vehiculo" className="block text-sm font-medium text-taller-gray dark:text-gray-400 mb-1">Vehículo</label>
                                <select id="vehiculo" value={selectedVehiculoId} onChange={e => setSelectedVehiculoId(e.target.value)} disabled={!selectedClienteId} className="block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-taller-primary focus:border-taller-primary sm:text-sm disabled:bg-gray-200 dark:disabled:bg-gray-700/50" required>
                                    <option value="">Seleccione un vehículo</option>
                                    {selectedClientVehiculos.map(v => <option key={v.id} value={v.id}>{`${v.marca} ${v.modelo} (${v.matricula})`}</option>)}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label htmlFor="descripcion" className="block text-sm font-medium text-taller-gray dark:text-gray-400">Descripción del Problema/Trabajo</label>
                            <textarea id="descripcion" value={descripcion} onChange={e => setDescripcion(e.target.value)} rows={3} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-taller-primary focus:border-taller-primary sm:text-sm" required />
                        </div>

                        {isEditMode && (
                            <div>
                                <label htmlFor="status" className="block text-sm font-medium text-taller-gray dark:text-gray-400">Estado del Trabajo</label>
                                <select id="status" value={status} onChange={e => setStatus(e.target.value as JobStatus)} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-taller-primary focus:border-taller-primary sm:text-sm">
                                    {Object.values(JobStatus).map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        )}

                        <div>
                            <h3 className="text-md font-semibold text-taller-dark dark:text-taller-light mb-2">Items</h3>
                            {partes.map((parte, index) => (
                                <div key={index} className="flex items-center gap-2 mb-2">
                                    {parte.isCategory ? (
                                        <>
                                            <input type="text" placeholder="Nombre de la categoría" value={parte.nombre} onChange={e => handleParteChange(index, 'nombre', e.target.value)} className="block w-full px-3 py-2 bg-blue-50 dark:bg-gray-700/50 border border-blue-200 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-taller-primary focus:border-taller-primary sm:text-sm font-semibold" />
                                            <button type="button" onClick={() => removeParte(index)} className="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-full flex-shrink-0"><TrashIcon className="h-5 w-5"/></button>
                                        </>
                                    ) : (
                                        <div className="grid grid-cols-6 sm:grid-cols-[1fr_80px_120px_auto] items-center gap-2 w-full">
                                            <textarea
                                                rows={1}
                                                placeholder="Nombre del ítem"
                                                value={parte.nombre}
                                                onChange={e => handleParteChange(index, 'nombre', e.target.value)}
                                                onInput={handleTextareaResize}
                                                className="col-span-6 sm:col-span-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-taller-primary focus:border-taller-primary sm:text-sm resize-none overflow-hidden"
                                            />
                                            <input type="number" placeholder="Cant." value={parte.cantidad} onChange={e => handleParteChange(index, 'cantidad', parseInt(e.target.value, 10) || 1)} className="col-span-2 sm:col-span-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-taller-primary focus:border-taller-primary sm:text-sm" />
                                            <input type="text" inputMode="decimal" placeholder="$ 0,00" value={parte.precioUnitario} onChange={e => handleParteChange(index, 'precioUnitario', formatCurrency(e.target.value))} className="col-span-3 sm:col-span-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-taller-primary focus:border-taller-primary sm:text-sm" />
                                            <button type="button" onClick={() => removeParte(index)} className="col-span-1 sm:col-span-1 p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-full justify-self-center sm:justify-self-auto"><TrashIcon className="h-5 w-5"/></button>
                                        </div>
                                    )}
                                </div>
                            ))}
                           <div className="flex items-center gap-4 mt-2">
                                <button type="button" onClick={addParte} className="flex items-center gap-1 text-sm text-taller-primary font-medium hover:underline">
                                    <PlusIcon className="h-4 w-4"/> Añadir Ítem
                                </button>
                                <button type="button" onClick={addCategory} className="flex items-center gap-1 text-sm text-taller-secondary font-medium hover:underline">
                                    <PlusIcon className="h-4 w-4"/> Añadir Categoría
                                </button>
                            </div>
                        </div>

                        {isEditMode && pagos.length > 0 && (
                            <div>
                                <h3 className="text-md font-semibold text-taller-dark dark:text-taller-light mb-2 border-t dark:border-gray-600 pt-4">Historial de Pagos</h3>
                                <div className="space-y-2">
                                    {pagos.map((pago, index) => (
                                        <div key={index} className="flex justify-between items-center p-2 bg-taller-light dark:bg-gray-700/50 rounded-md">
                                            <div>
                                                <p className="font-semibold text-green-600 dark:text-green-500">{new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(pago.precioUnitario)}</p>
                                                <p className="text-xs text-taller-gray dark:text-gray-400">
                                                    Registrado el {new Date(pago.fecha!).toLocaleDateString('es-ES')}
                                                </p>
                                            </div>
                                            <button type="button" onClick={() => handleRemovePago(index)} className="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-full">
                                                <TrashIcon className="h-5 w-5"/>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                            <div>
                                <label htmlFor="costoManoDeObra" className="block text-sm font-medium text-taller-gray dark:text-gray-400">Costo Mano de Obra ($)</label>
                                <input type="text" id="costoManoDeObra" inputMode="decimal" placeholder="$ 0,00" value={costoManoDeObra} onChange={e => setCostoManoDeObra(formatCurrency(e.target.value))} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-taller-primary focus:border-taller-primary sm:text-sm" />
                            </div>
                            <div className="bg-taller-light dark:bg-gray-700/50 p-3 rounded-md text-right">
                                <p className="text-sm text-taller-gray dark:text-gray-400">Costo Total Estimado</p>
                                <p className="text-xl font-bold text-taller-dark dark:text-taller-light">{new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(costoEstimado)}</p>
                            </div>
                        </div>
                        
                        {error && <p className="text-sm text-red-600">{error}</p>}

                        <div className="pt-4 flex flex-col-reverse sm:flex-row items-center gap-4 w-full">
                            {isEditMode ? (
                                <div className="w-full sm:flex-1">
                                    {!confirmingDelete ? (
                                        <button
                                            type="button"
                                            onClick={() => setConfirmingDelete(true)}
                                            className="w-full flex items-center justify-center gap-2 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
                                        >
                                            <TrashIcon className="h-5 w-5"/>
                                            Eliminar Trabajo
                                        </button>
                                    ) : (
                                        <div className="flex items-center justify-center gap-3">
                                            <p className="text-sm font-medium text-red-700 animate-pulse">¿Confirmar?</p>
                                            <button
                                                type="button"
                                                onClick={handleDeleteJob}
                                                disabled={isDeleting}
                                                className="py-1 px-3 text-sm font-bold text-white bg-red-600 rounded-md hover:bg-red-700"
                                            >
                                                {isDeleting ? '...' : 'Sí'}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setConfirmingDelete(false)}
                                                disabled={isDeleting}
                                                className="py-1 px-3 text-sm font-medium text-gray-700 bg-gray-200 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500 rounded-md"
                                            >
                                                No
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ) : <div className="hidden sm:block sm:flex-1"></div>}
                            <div className="w-full sm:flex-1">
                                <button type="button" onClick={onClose} className="w-full justify-center py-2 px-4 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                    Cancelar
                                </button>
                            </div>
                             <div className="w-full sm:flex-1">
                                <button type="submit" disabled={isSubmitting || isDeleting} className="w-full justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-taller-primary hover:bg-taller-secondary disabled:opacity-50">
                                    {isSubmitting ? 'Guardando...' : (isEditMode ? 'Guardar Cambios' : 'Crear Presupuesto')}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
            {isClientModalOpen && (
                <CrearClienteModal
                    onClose={() => setIsClientModalOpen(false)}
                    onSuccess={() => {
                        setIsClientModalOpen(false);
                        onDataRefresh();
                    }}
                />
            )}
        </>
    );
};

export default CrearTrabajoModal;