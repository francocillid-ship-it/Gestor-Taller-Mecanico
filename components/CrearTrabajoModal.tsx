
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import type { Cliente, Parte, Trabajo } from '../types';
import { JobStatus } from '../types';
import { XMarkIcon, TrashIcon, UserPlusIcon, WrenchScrewdriverIcon, TagIcon, ArchiveBoxIcon } from '@heroicons/react/24/solid';
import CrearClienteModal from './CrearClienteModal';
import { ALL_MAINTENANCE_OPTS } from '../constants';

interface CrearTrabajoModalProps {
    onClose: () => void;
    onSuccess: () => void;
    onDataRefresh: () => void;
    clientes: Cliente[];
    trabajoToEdit?: Trabajo;
    initialClientId?: string;
}

type ParteState = {
    nombre: string;
    cantidad: number | ''; // Changed to allow empty string for input handling
    precioUnitario: string; // Storing the formatted string
    isCategory?: boolean;
    isService?: boolean;
    maintenanceType?: string;
};


const CrearTrabajoModal: React.FC<CrearTrabajoModalProps> = ({ onClose, onSuccess, onDataRefresh, clientes, trabajoToEdit, initialClientId }) => {
    const [selectedClienteId, setSelectedClienteId] = useState('');
    const [selectedVehiculoId, setSelectedVehiculoId] = useState('');
    const [descripcion, setDescripcion] = useState('');
    const [kilometraje, setKilometraje] = useState(''); 
    const [partes, setPartes] = useState<ParteState[]>([]);
    const [status, setStatus] = useState<JobStatus>(JobStatus.Presupuesto);
    const [pagos, setPagos] = useState<Parte[]>([]);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [error, setError] = useState('');
    const [isClientModalOpen, setIsClientModalOpen] = useState(false);
    const [confirmingDelete, setConfirmingDelete] = useState(false);
    
    // Almacenamiento local temporal para el cliente recién creado
    const [localNewClient, setLocalNewClient] = useState<Cliente | null>(null);

    const isEditMode = Boolean(trabajoToEdit);

    const mergedClientes = useMemo(() => {
        const map = new Map<string, Cliente>();
        clientes.forEach(c => map.set(c.id, c));
        if (localNewClient) {
            map.set(localNewClient.id, localNewClient);
        }
        return Array.from(map.values());
    }, [clientes, localNewClient]);

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
        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;
    };

    // Initialization Effect
    useEffect(() => {
        if (trabajoToEdit) {
            setSelectedClienteId(trabajoToEdit.clienteId);
            setSelectedVehiculoId(trabajoToEdit.vehiculoId);
            setDescripcion(trabajoToEdit.descripcion);
            setKilometraje(trabajoToEdit.kilometraje ? String(trabajoToEdit.kilometraje) : '');
            
            const initialPartes = trabajoToEdit.partes.filter(p => p.nombre !== '__PAGO_REGISTRADO__');
            
            const hasServices = initialPartes.some(p => p.isService);
            const legacyLabor = trabajoToEdit.costoManoDeObra || 0;
            
            let processedPartes = initialPartes.map(p => ({
                ...p,
                precioUnitario: formatNumberToCurrency(p.precioUnitario),
                maintenanceType: p.maintenanceType || ''
            }));

            if (!hasServices && legacyLabor > 0) {
                processedPartes.push({
                    nombre: 'Mano de Obra (General)',
                    cantidad: 1,
                    precioUnitario: formatNumberToCurrency(legacyLabor),
                    isService: true,
                    isCategory: false
                });
            }

            setPartes(processedPartes);
            setPagos(trabajoToEdit.partes.filter(p => p.nombre === '__PAGO_REGISTRADO__'));
            setStatus(trabajoToEdit.status);
        } else if (initialClientId) {
            // Set client visually immediate to avoid empty dropdown
            setSelectedClienteId(initialClientId);

            // AGGRESSIVE POLLING: 
            // Ignore global 'clientes' prop initially and fetch direct from DB to ensure vehicle data is present.
            // This handles the race condition where page reloads before DB propagates completely.
            const fetchVehicleData = async () => {
                let attempts = 0;
                // Try for up to 7.5 seconds
                while (attempts < 15) { 
                    const { data } = await supabase
                        .from('clientes')
                        .select('*, vehiculos(*)')
                        .eq('id', initialClientId)
                        .maybeSingle();
                    
                    if (data && data.vehiculos && data.vehiculos.length > 0) {
                        const clientData = data as Cliente;
                        setLocalNewClient(clientData);
                        
                        // Force update selectedClient to trigger downstream effects if needed
                        setSelectedClienteId(clientData.id); 
                        
                        // Automatically select the last vehicle (newest)
                        const lastVehicle = clientData.vehiculos[clientData.vehiculos.length - 1];
                        setSelectedVehiculoId(lastVehicle.id);
                        return; // Success
                    }
                    
                    // Wait 500ms before retry
                    await new Promise(r => setTimeout(r, 500));
                    attempts++;
                }
                
                // Fallback: If polling timed out, check if it loaded in the global list meanwhile
                const existing = clientes.find(c => c.id === initialClientId);
                if (existing && existing.vehiculos && existing.vehiculos.length > 0) {
                     const lastVehicle = existing.vehiculos[existing.vehiculos.length - 1];
                     setSelectedVehiculoId(lastVehicle.id);
                }
            };
            
            fetchVehicleData();
        }
    }, [trabajoToEdit, initialClientId]); // Dependencies clean to prevent unnecessary re-runs

    const handleClientCreatedIntermediate = (newClientId: string) => {
        // This is called BEFORE session restore/reload
        localStorage.setItem('pending_job_client_id', newClientId);
    };

    const handleClientCreated = async (newClientId?: string, hasVehicles?: boolean) => {
        setIsClientModalOpen(false);
        // Standard flow for edit mode (no reload)
        if (newClientId) {
             const { data } = await supabase
                .from('clientes')
                .select('*, vehiculos(*)')
                .eq('id', newClientId)
                .single();
            if (data) {
                setLocalNewClient(data as Cliente);
                setSelectedClienteId(data.id);
            }
            onDataRefresh();
        }
    };

    const selectedClientVehiculos = useMemo(() => {
        if (!selectedClienteId) return [];
        const cliente = mergedClientes.find(c => c.id === selectedClienteId);
        return cliente?.vehiculos || [];
    }, [selectedClienteId, mergedClientes]);
    
    useEffect(() => {
        if(selectedClienteId && !isEditMode) {
             const cliente = mergedClientes.find(c => c.id === selectedClienteId);
             
             if (selectedVehiculoId) {
                 const vehicleExists = cliente?.vehiculos.some(v => v.id === selectedVehiculoId);
                 if (!vehicleExists) setSelectedVehiculoId('');
             }

             if (cliente && cliente.vehiculos.length > 0 && !selectedVehiculoId) {
                 const vehicleToSelect = cliente.vehiculos.length === 1 
                    ? cliente.vehiculos[0] 
                    : cliente.vehiculos[cliente.vehiculos.length - 1]; 
                 
                 setSelectedVehiculoId(vehicleToSelect.id);
             }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedClienteId, mergedClientes]);

    const costoEstimado = useMemo(() => {
        return partes.filter(p => !p.isCategory).reduce((sum, p) => sum + (Number(p.cantidad || 0) * parseCurrency(p.precioUnitario)), 0);
    }, [partes]);


    const handleParteChange = (index: number, field: keyof ParteState, value: string | number) => {
        const newPartes = [...partes];
        const currentParte = newPartes[index];
        
        if (field === 'nombre' && typeof value === 'string') {
            const lowerValue = value.toLowerCase();
            const capitalizedValue = value.length > 0 ? value.charAt(0).toUpperCase() + value.slice(1) : value;
             (currentParte as any)[field] = capitalizedValue;

            if (!currentParte.maintenanceType) {
                const matchedType = ALL_MAINTENANCE_OPTS.find(opt => 
                    opt.keywords.some(keyword => lowerValue.includes(keyword))
                );
                if (matchedType) {
                    currentParte.maintenanceType = matchedType.key;
                }
            }
        } else {
             (currentParte as any)[field] = value;
        }
        
        setPartes(newPartes);
    };

    const addParte = () => {
        setPartes([...partes, { nombre: '', cantidad: 1, precioUnitario: '', isService: false, maintenanceType: '' }]);
    };
    
    const addService = () => {
        setPartes([...partes, { nombre: '', cantidad: 1, precioUnitario: '', isService: true, maintenanceType: '' }]);
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

            onDataRefresh();
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
                    cantidad: p.isCategory ? 0 : Number(p.cantidad || 1),
                    precioUnitario: p.isCategory ? 0 : parseCurrency(p.precioUnitario),
                    isCategory: !!p.isCategory,
                    isService: !!p.isService,
                    maintenanceType: p.maintenanceType || undefined
                }));
            
            const calculatedManoDeObra = cleanPartes
                .filter(p => p.isService && !p.isCategory)
                .reduce((sum, p) => sum + (p.cantidad * p.precioUnitario), 0);
            
            const kmValue = kilometraje ? parseInt(kilometraje, 10) : null;

            const jobData = {
                cliente_id: selectedClienteId,
                vehiculo_id: selectedVehiculoId,
                taller_id: user.id,
                descripcion,
                partes: [...cleanPartes, ...pagos],
                costo_mano_de_obra: calculatedManoDeObra,
                costo_estimado: costoEstimado,
                status: status,
                fecha_entrada: trabajoToEdit?.fechaEntrada || new Date().toISOString(),
                kilometraje: kmValue,
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

            localStorage.removeItem('pending_job_client_id');
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
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
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
                                    {mergedClientes.map(c => <option key={c.id} value={c.id}>{`${c.nombre} ${c.apellido || ''}`.trim()}</option>)}
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

                         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                             <div className="md:col-span-2">
                                <label htmlFor="descripcion" className="block text-sm font-medium text-taller-gray dark:text-gray-400">Descripción del Problema/Trabajo (Opcional)</label>
                                <textarea id="descripcion" value={descripcion} onChange={e => setDescripcion(e.target.value)} rows={2} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-taller-primary focus:border-taller-primary sm:text-sm" />
                            </div>
                             <div>
                                <label htmlFor="kilometraje" className="block text-sm font-medium text-taller-gray dark:text-gray-400">Kilometraje (Opcional)</label>
                                <input 
                                    type="number" 
                                    id="kilometraje" 
                                    value={kilometraje} 
                                    onChange={e => setKilometraje(e.target.value)} 
                                    placeholder="Ej. 150000"
                                    className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-taller-primary focus:border-taller-primary sm:text-sm" 
                                />
                            </div>
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
                            <h3 className="text-md font-semibold text-taller-dark dark:text-taller-light mb-2">Items y Servicios</h3>
                            {partes.map((parte, index) => (
                                <div key={index} className="flex items-center gap-2 mb-2">
                                    {parte.isCategory ? (
                                        <>
                                            <div className="p-2 bg-taller-accent/10 rounded-full"><TagIcon className="h-5 w-5 text-taller-accent"/></div>
                                            <input type="text" placeholder="Nombre de la categoría" value={parte.nombre} onChange={e => handleParteChange(index, 'nombre', e.target.value)} className="block w-full px-3 py-2 bg-blue-50 dark:bg-gray-700/50 border border-blue-200 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-taller-primary focus:border-taller-primary sm:text-sm font-semibold" />
                                            <button type="button" onClick={() => removeParte(index)} className="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-full flex-shrink-0"><TrashIcon className="h-5 w-5"/></button>
                                        </>
                                    ) : (
                                        <div className={`grid grid-cols-6 sm:grid-cols-[auto_1fr_130px_70px_100px_auto] items-center gap-2 w-full p-2 rounded-md ${parte.isService ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800' : 'bg-gray-50 dark:bg-gray-700/30'}`}>
                                            <div className="col-span-6 sm:col-span-1 flex justify-center sm:justify-start">
                                                {parte.isService ? (
                                                    <div title="Servicio (Mano de Obra)" className="p-1.5 bg-blue-100 dark:bg-blue-900 rounded text-blue-600 dark:text-blue-300">
                                                        <WrenchScrewdriverIcon className="h-4 w-4"/>
                                                    </div>
                                                ) : (
                                                    <div title="Ítem (Repuesto)" className="p-1.5 bg-gray-200 dark:bg-gray-600 rounded text-gray-600 dark:text-gray-300">
                                                        <ArchiveBoxIcon className="h-4 w-4"/>
                                                    </div>
                                                )}
                                            </div>
                                            
                                            <textarea
                                                rows={1}
                                                placeholder={parte.isService ? "Descripción del servicio" : "Nombre del repuesto"}
                                                value={parte.nombre}
                                                onChange={e => handleParteChange(index, 'nombre', e.target.value)}
                                                onInput={handleTextareaResize}
                                                className="col-span-6 sm:col-span-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-taller-primary focus:border-taller-primary sm:text-sm resize-none overflow-hidden"
                                            />

                                            <select
                                                value={parte.maintenanceType || ''}
                                                onChange={e => handleParteChange(index, 'maintenanceType', e.target.value)}
                                                className="col-span-3 sm:col-span-1 block w-full px-2 py-2 text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-taller-primary focus:border-taller-primary text-gray-600 dark:text-gray-300"
                                            >
                                                <option value="">Etiqueta (Opcional)</option>
                                                {ALL_MAINTENANCE_OPTS.map(opt => (
                                                    <option key={opt.key} value={opt.key}>{opt.label}</option>
                                                ))}
                                            </select>

                                            <input 
                                                type="number" 
                                                placeholder="Cant." 
                                                value={parte.cantidad} 
                                                onFocus={(e) => {
                                                    if (parte.cantidad === 1) {
                                                        handleParteChange(index, 'cantidad', '');
                                                    }
                                                }}
                                                onBlur={() => {
                                                    if (parte.cantidad === '' || parte.cantidad === 0) {
                                                        handleParteChange(index, 'cantidad', 1);
                                                    }
                                                }}
                                                onChange={e => {
                                                    const val = e.target.value;
                                                    handleParteChange(index, 'cantidad', val === '' ? '' : parseInt(val, 10));
                                                }} 
                                                className="col-span-1 sm:col-span-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-taller-primary focus:border-taller-primary sm:text-sm no-spinner" 
                                            />
                                            <input type="text" inputMode="decimal" placeholder="$ 0,00" value={parte.precioUnitario} onChange={e => handleParteChange(index, 'precioUnitario', formatCurrency(e.target.value))} className="col-span-2 sm:col-span-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-taller-primary focus:border-taller-primary sm:text-sm" />
                                            <button type="button" onClick={() => removeParte(index)} className="col-span-1 sm:col-span-1 p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-full justify-self-center sm:justify-self-auto"><TrashIcon className="h-5 w-5"/></button>
                                        </div>
                                    )}
                                </div>
                            ))}
                           <div className="flex flex-wrap items-center gap-3 mt-4 p-3 bg-gray-50 dark:bg-gray-800 border border-dashed dark:border-gray-600 rounded-lg justify-center sm:justify-start">
                                <button type="button" onClick={addParte} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 font-medium shadow-sm transition-colors">
                                    <ArchiveBoxIcon className="h-4 w-4 text-gray-500"/> Agregar Ítem
                                </button>
                                <button type="button" onClick={addService} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/50 font-medium shadow-sm transition-colors">
                                    <WrenchScrewdriverIcon className="h-4 w-4"/> Agregar Servicio
                                </button>
                                <button type="button" onClick={addCategory} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800 rounded-md hover:bg-orange-100 dark:hover:bg-orange-900/50 font-medium shadow-sm transition-colors">
                                    <TagIcon className="h-4 w-4"/> Agregar Categoría
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

                        <div className="flex justify-end items-center pt-4 border-t dark:border-gray-700">
                            <div className="bg-taller-light dark:bg-gray-700/50 p-4 rounded-lg text-right w-full sm:w-auto">
                                <p className="text-sm text-taller-gray dark:text-gray-400 font-medium">Costo Total Estimado</p>
                                <p className="text-2xl font-bold text-taller-primary dark:text-blue-400">{new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(costoEstimado)}</p>
                            </div>
                        </div>
                        
                        {error && <p className="text-sm text-red-600 text-center">{error}</p>}

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
                    onSuccess={handleClientCreated}
                    onClientCreated={handleClientCreatedIntermediate}
                />
            )}
            <style>{`
                .no-spinner::-webkit-inner-spin-button,
                .no-spinner::-webkit-outer-spin-button {
                    -webkit-appearance: none;
                    margin: 0;
                }
                .no-spinner {
                    -moz-appearance: textfield;
                }
            `}</style>
        </>
    );
};

export default CrearTrabajoModal;
