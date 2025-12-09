
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../supabaseClient';
import type { Cliente, Parte, Trabajo } from '../types';
import { JobStatus } from '../types';
import { XMarkIcon, TrashIcon, UserPlusIcon, WrenchScrewdriverIcon, TagIcon, ArchiveBoxIcon, Bars3Icon, PencilIcon, CheckIcon, ShoppingBagIcon } from '@heroicons/react/24/solid';
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
    _id: string; // Unique local ID for drag and drop keys
    nombre: string;
    cantidad: number | ''; // Changed to allow empty string for input handling
    precioUnitario: string; // Storing the formatted string
    isCategory?: boolean;
    isService?: boolean;
    maintenanceType?: string;
    clientPaidDirectly?: boolean;
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
    const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
    
    // Almacenamiento local temporal para el cliente recién creado
    const [localNewClient, setLocalNewClient] = useState<Cliente | null>(null);

    // Estado para edición de pagos
    const [editingPaymentIndex, setEditingPaymentIndex] = useState<number | null>(null);
    const [editingPaymentAmount, setEditingPaymentAmount] = useState('');
    const [editingPaymentType, setEditingPaymentType] = useState<'items' | 'labor' | undefined>(undefined);

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

    // Helper to generate IDs
    const generateId = () => Math.random().toString(36).substr(2, 9);

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
                _id: generateId(),
                precioUnitario: formatNumberToCurrency(p.precioUnitario),
                maintenanceType: p.maintenanceType || '',
                clientPaidDirectly: p.clientPaidDirectly
            }));

            if (!hasServices && legacyLabor > 0) {
                processedPartes.push({
                    _id: generateId(),
                    nombre: 'Mano de Obra (General)',
                    cantidad: 1,
                    precioUnitario: formatNumberToCurrency(legacyLabor),
                    isService: true,
                    isCategory: false,
                    maintenanceType: '' // Added missing property
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

    const handleClientCreated = async (newClient?: Cliente) => {
        setIsClientModalOpen(false);
        // Standard flow for edit mode (no reload)
        if (newClient) {
            setLocalNewClient(newClient);
            setSelectedClienteId(newClient.id);
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
        // Only include parts NOT paid directly by client for the total estimation to charge
        // Wait, normally CostoEstimado IS the total value.
        // But for "Total a Cobrar" display here, we might want to exclude client paid parts?
        // The JobCard shows "Total a Cobrar" excluding client paid.
        // Let's keep consistent.
        return partes
            .filter(p => !p.isCategory && !p.clientPaidDirectly)
            .reduce((sum, p) => sum + (Number(p.cantidad || 0) * parseCurrency(p.precioUnitario)), 0);
    }, [partes]);


    const handleParteChange = (index: number, field: keyof ParteState, value: string | number | boolean) => {
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
        } else if (field === 'clientPaidDirectly') {
            (currentParte as any)[field] = value;
            // Handle category toggle logic
            if (currentParte.isCategory) {
                 for (let i = index + 1; i < newPartes.length; i++) {
                    if (newPartes[i].isCategory) break; 
                    newPartes[i].clientPaidDirectly = value as boolean;
                }
            }
        } else {
             (currentParte as any)[field] = value;
        }
        
        setPartes(newPartes);
    };

    const addParte = () => {
        setPartes([...partes, { _id: generateId(), nombre: '', cantidad: 1, precioUnitario: '', isService: false, maintenanceType: '' }]);
    };
    
    const addService = () => {
        setPartes([...partes, { _id: generateId(), nombre: '', cantidad: 1, precioUnitario: '', isService: true, maintenanceType: '' }]);
    };
    
    const addCategory = () => {
        setPartes([...partes, { _id: generateId(), nombre: '', cantidad: 0, precioUnitario: '', isCategory: true }]);
    };


    const removeParte = (index: number) => {
        const newPartes = partes.filter((_, i) => i !== index);
        setPartes(newPartes);
    };

    // HTML5 Drag and Drop Handlers (Desktop)
    const handleDragStart = (index: number) => {
        setDraggedItemIndex(index);
    };

    const handleDragEnter = (index: number) => {
        if (draggedItemIndex === null || draggedItemIndex === index) return;
        
        const newPartes = [...partes];
        const item = newPartes[draggedItemIndex];
        
        // Remove item from old position
        newPartes.splice(draggedItemIndex, 1);
        // Insert item at new position
        newPartes.splice(index, 0, item);
        
        setPartes(newPartes);
        setDraggedItemIndex(index);
    };

    const handleDragEnd = () => {
        setDraggedItemIndex(null);
    };

    // Custom Touch Handlers (Mobile)
    const handleTouchStart = (index: number) => {
        setDraggedItemIndex(index);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (draggedItemIndex === null) return;
        
        // Prevent scrolling while dragging
        e.preventDefault();
        
        const touch = e.touches[0];
        const target = document.elementFromPoint(touch.clientX, touch.clientY);
        
        if (!target) return;
        
        const row = target.closest('[data-index]');
        if (row) {
            const newIndex = parseInt(row.getAttribute('data-index') || '-1', 10);
            if (newIndex !== -1 && newIndex !== draggedItemIndex) {
                 const newPartes = [...partes];
                 const item = newPartes[draggedItemIndex];
                 newPartes.splice(draggedItemIndex, 1);
                 newPartes.splice(newIndex, 0, item);
                 setPartes(newPartes);
                 setDraggedItemIndex(newIndex);
            }
        }
    };

    const handleTouchEnd = () => {
        setDraggedItemIndex(null);
    };
    
    const startEditingPayment = (index: number) => {
        const pago = pagos[index];
        setEditingPaymentIndex(index);
        setEditingPaymentAmount(formatNumberToCurrency(pago.precioUnitario));
        setEditingPaymentType(pago.paymentType);
    };

    const saveEditingPayment = () => {
        if (editingPaymentIndex === null) return;

        const newPagos = [...pagos];
        newPagos[editingPaymentIndex] = {
            ...newPagos[editingPaymentIndex],
            precioUnitario: parseCurrency(editingPaymentAmount),
            paymentType: editingPaymentType
        };
        setPagos(newPagos);
        cancelEditingPayment();
    };

    const cancelEditingPayment = () => {
        setEditingPaymentIndex(null);
        setEditingPaymentAmount('');
        setEditingPaymentType(undefined);
    };

    const deleteEditingPayment = () => {
        if (editingPaymentIndex === null) return;
        setPagos(currentPagos => currentPagos.filter((_, index) => index !== editingPaymentIndex));
        cancelEditingPayment();
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
                    maintenanceType: p.maintenanceType || undefined,
                    clientPaidDirectly: !!p.clientPaidDirectly
                }));
            
            const calculatedManoDeObra = cleanPartes
                .filter(p => p.isService && !p.isCategory && !p.clientPaidDirectly)
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

    const modalContent = (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-end sm:items-center z-[100] sm:p-4">
            <div className="bg-white dark:bg-gray-800 w-full h-[100dvh] sm:h-auto sm:max-h-[90vh] sm:max-w-3xl sm:rounded-xl shadow-2xl flex flex-col overflow-hidden">
                
                {/* Header - Fixed */}
                <div className="flex justify-between items-center p-4 border-b dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
                    <h2 className="text-lg sm:text-xl font-bold text-taller-dark dark:text-taller-light truncate pr-4">
                        {isEditMode ? 'Editar Trabajo' : 'Crear Nuevo Presupuesto'}
                    </h2>
                    <button onClick={onClose} className="p-2 -mr-2 text-taller-gray dark:text-gray-400 hover:text-taller-dark dark:hover:text-white rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                        <XMarkIcon className="h-6 w-6" />
                    </button>
                </div>
                
                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-5 overscroll-contain">
                    <form id="job-form" onSubmit={handleSubmit} className="space-y-5 text-taller-dark dark:text-taller-light pb-24 sm:pb-0">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label htmlFor="cliente" className="block text-sm font-medium text-taller-gray dark:text-gray-400">Cliente</label>
                                     <button type="button" onClick={() => setIsClientModalOpen(true)} className="flex items-center gap-1 text-xs text-taller-primary font-medium hover:underline">
                                        <UserPlusIcon className="h-4 w-4"/> Nuevo Cliente
                                    </button>
                                </div>
                                <select id="cliente" value={selectedClienteId} onChange={e => setSelectedClienteId(e.target.value)} className="block w-full px-3 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-taller-primary focus:border-transparent sm:text-sm" required>
                                    <option value="">Seleccione un cliente</option>
                                    {mergedClientes.map(c => <option key={c.id} value={c.id}>{`${c.nombre} ${c.apellido || ''}`.trim()}</option>)}
                                </select>
                            </div>
                            <div>
                                <label htmlFor="vehiculo" className="block text-sm font-medium text-taller-gray dark:text-gray-400 mb-1">Vehículo</label>
                                <select id="vehiculo" value={selectedVehiculoId} onChange={e => setSelectedVehiculoId(e.target.value)} disabled={!selectedClienteId} className="block w-full px-3 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-taller-primary focus:border-transparent sm:text-sm disabled:bg-gray-100 dark:disabled:bg-gray-700/50 disabled:text-gray-400" required>
                                    <option value="">Seleccione un vehículo</option>
                                    {selectedClientVehiculos.map(v => <option key={v.id} value={v.id}>{`${v.marca} ${v.modelo} (${v.matricula})`}</option>)}
                                </select>
                            </div>
                        </div>

                         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                             <div className="md:col-span-2">
                                <label htmlFor="descripcion" className="block text-sm font-medium text-taller-gray dark:text-gray-400 mb-1">Descripción (Opcional)</label>
                                <textarea id="descripcion" value={descripcion} onChange={e => setDescripcion(e.target.value)} rows={2} className="block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-taller-primary focus:border-transparent sm:text-sm" />
                            </div>
                             <div>
                                <label htmlFor="kilometraje" className="block text-sm font-medium text-taller-gray dark:text-gray-400 mb-1">Kilometraje</label>
                                <input 
                                    type="number" 
                                    id="kilometraje" 
                                    value={kilometraje} 
                                    onChange={e => setKilometraje(e.target.value)} 
                                    placeholder="Ej. 150000"
                                    className="block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-taller-primary focus:border-transparent sm:text-sm" 
                                />
                            </div>
                        </div>

                        {isEditMode && (
                            <div>
                                <label htmlFor="status" className="block text-sm font-medium text-taller-gray dark:text-gray-400 mb-1">Estado</label>
                                <select id="status" value={status} onChange={e => setStatus(e.target.value as JobStatus)} className="block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-taller-primary focus:border-transparent sm:text-sm">
                                    {Object.values(JobStatus).map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        )}

                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-md font-semibold text-taller-dark dark:text-taller-light">Items y Servicios</h3>
                            </div>
                            
                            <div className="space-y-3">
                                {partes.map((parte, index) => (
                                    <div 
                                        key={parte._id}
                                        data-index={index}
                                        className={`flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2 rounded-lg border dark:border-gray-700 transition-colors ${draggedItemIndex === index ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300' : 'bg-gray-50 dark:bg-gray-700/30'}`}
                                        draggable={true}
                                        onDragStart={() => handleDragStart(index)}
                                        onDragEnter={() => handleDragEnter(index)}
                                        onDragEnd={handleDragEnd}
                                        onDragOver={(e) => e.preventDefault()}
                                    >
                                        {parte.isCategory ? (
                                            <div className="flex items-center gap-2 w-full">
                                                 <div 
                                                    className="cursor-move p-1 text-gray-400 hover:text-taller-primary touch-none"
                                                    onTouchStart={() => handleTouchStart(index)}
                                                    onTouchMove={handleTouchMove}
                                                    onTouchEnd={handleTouchEnd}
                                                >
                                                    <Bars3Icon className="h-5 w-5"/>
                                                </div>
                                                <TagIcon className="h-5 w-5 text-taller-accent flex-shrink-0"/>
                                                <input 
                                                    type="text" 
                                                    placeholder="Nombre de la categoría" 
                                                    value={parte.nombre} 
                                                    onChange={e => handleParteChange(index, 'nombre', e.target.value)} 
                                                    className="flex-grow min-w-0 px-3 py-2 bg-transparent border-b border-transparent focus:border-taller-primary focus:outline-none font-semibold text-taller-dark dark:text-taller-light" 
                                                />
                                                <button 
                                                    type="button" 
                                                    onClick={() => handleParteChange(index, 'clientPaidDirectly', !parte.clientPaidDirectly)}
                                                    className={`p-2 rounded-full transition-colors ${parte.clientPaidDirectly ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-300' : 'text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                                                    title="Marcar categoría pagada por cliente"
                                                >
                                                    <ShoppingBagIcon className="h-5 w-5"/>
                                                </button>
                                                <button type="button" onClick={() => removeParte(index)} className="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-full">
                                                    <TrashIcon className="h-5 w-5"/>
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                {/* Mobile Row Layout: Header with Drag, Icon, Name, Delete */}
                                                <div className="flex items-center gap-2 sm:hidden w-full">
                                                     <div 
                                                        className="cursor-move p-1 text-gray-400 touch-none"
                                                        onTouchStart={() => handleTouchStart(index)}
                                                        onTouchMove={handleTouchMove}
                                                        onTouchEnd={handleTouchEnd}
                                                    >
                                                        <Bars3Icon className="h-5 w-5"/>
                                                    </div>
                                                    <div className={`p-1.5 rounded-md flex-shrink-0 ${parte.isService ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-600'}`}>
                                                        {parte.isService ? <WrenchScrewdriverIcon className="h-4 w-4"/> : <ArchiveBoxIcon className="h-4 w-4"/>}
                                                    </div>
                                                    <input 
                                                        type="text" 
                                                        placeholder={parte.isService ? "Servicio" : "Repuesto"}
                                                        value={parte.nombre}
                                                        onChange={e => handleParteChange(index, 'nombre', e.target.value)}
                                                        className={`flex-grow min-w-0 px-2 py-1 bg-transparent focus:outline-none text-sm font-medium ${parte.clientPaidDirectly ? 'line-through text-gray-400' : ''}`}
                                                    />
                                                    {/* Only show button if NOT a service */}
                                                    {!parte.isService && (
                                                        <button 
                                                            type="button" 
                                                            onClick={() => handleParteChange(index, 'clientPaidDirectly', !parte.clientPaidDirectly)}
                                                            className={`p-1 rounded transition-colors ${parte.clientPaidDirectly ? 'text-purple-600 bg-purple-50' : 'text-gray-400'}`}
                                                        >
                                                            <ShoppingBagIcon className="h-5 w-5"/>
                                                        </button>
                                                    )}
                                                    <button type="button" onClick={() => removeParte(index)} className="p-1 text-red-500">
                                                        <TrashIcon className="h-5 w-5"/>
                                                    </button>
                                                </div>
                                                
                                                {/* Mobile Row Layout: Controls (Qty, Price, Type) */}
                                                <div className="flex items-center gap-2 w-full sm:hidden pl-8">
                                                     <input 
                                                        type="number" 
                                                        placeholder="#" 
                                                        value={parte.cantidad} 
                                                        onChange={e => {
                                                            const val = e.target.value;
                                                            handleParteChange(index, 'cantidad', val === '' ? '' : parseInt(val, 10));
                                                        }}
                                                        className={`w-12 px-2 py-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-center text-sm ${parte.clientPaidDirectly ? 'opacity-50' : ''}`}
                                                    />
                                                     <input 
                                                        type="text" 
                                                        inputMode="decimal" 
                                                        placeholder="$ 0" 
                                                        value={parte.precioUnitario} 
                                                        onChange={e => handleParteChange(index, 'precioUnitario', formatCurrency(e.target.value))} 
                                                        className={`flex-1 min-w-0 px-2 py-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-sm text-right ${parte.clientPaidDirectly ? 'opacity-50 line-through' : ''}`} 
                                                    />
                                                </div>

                                                {/* Desktop Layout (Grid) */}
                                                <div className="hidden sm:grid sm:grid-cols-[auto_auto_1fr_130px_70px_100px_auto_auto] items-center gap-2 w-full">
                                                    <div className="cursor-move text-gray-400 hover:text-taller-primary" onDragStart={() => handleDragStart(index)}><Bars3Icon className="h-5 w-5"/></div>
                                                    <div title={parte.isService ? "Servicio" : "Repuesto"} className={`p-1.5 rounded ${parte.isService ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-600'}`}>
                                                        {parte.isService ? <WrenchScrewdriverIcon className="h-4 w-4"/> : <ArchiveBoxIcon className="h-4 w-4"/>}
                                                    </div>
                                                    <input 
                                                        type="text" 
                                                        value={parte.nombre} 
                                                        onChange={e => handleParteChange(index, 'nombre', e.target.value)} 
                                                        className={`w-full px-2 py-1 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded text-sm focus:outline-none focus:ring-1 focus:ring-taller-primary ${parte.clientPaidDirectly ? 'line-through text-gray-400' : ''}`}
                                                    />
                                                    <select
                                                        value={parte.maintenanceType || ''}
                                                        onChange={e => handleParteChange(index, 'maintenanceType', e.target.value)}
                                                        className="w-full px-2 py-1 text-xs bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded focus:outline-none focus:ring-1 focus:ring-taller-primary"
                                                    >
                                                        <option value="">Etiqueta (Opcional)</option>
                                                        {ALL_MAINTENANCE_OPTS.map(opt => <option key={opt.key} value={opt.key}>{opt.label}</option>)}
                                                    </select>
                                                    <input 
                                                        type="number" 
                                                        value={parte.cantidad} 
                                                        onChange={e => handleParteChange(index, 'cantidad', e.target.value === '' ? '' : parseInt(e.target.value, 10))} 
                                                        className={`w-full px-2 py-1 text-center bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded text-sm focus:outline-none focus:ring-1 focus:ring-taller-primary ${parte.clientPaidDirectly ? 'opacity-50' : ''}`} 
                                                    />
                                                    <input 
                                                        type="text" 
                                                        value={parte.precioUnitario} 
                                                        onChange={e => handleParteChange(index, 'precioUnitario', formatCurrency(e.target.value))} 
                                                        className={`w-full px-2 py-1 text-right bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded text-sm focus:outline-none focus:ring-1 focus:ring-taller-primary ${parte.clientPaidDirectly ? 'opacity-50 line-through' : ''}`} 
                                                    />
                                                    {/* Only show button if NOT a service */}
                                                    {!parte.isService && (
                                                        <button 
                                                            type="button" 
                                                            onClick={() => handleParteChange(index, 'clientPaidDirectly', !parte.clientPaidDirectly)}
                                                            className={`p-1.5 rounded-full transition-colors ${parte.clientPaidDirectly ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-300' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                                                            title="Marcar pagado por cliente"
                                                        >
                                                            <ShoppingBagIcon className="h-4 w-4"/>
                                                        </button>
                                                    )}
                                                    {/* Placeholder div to keep grid alignment if button is hidden */}
                                                    {parte.isService && <div className="w-[28px]"></div>}

                                                    <button type="button" onClick={() => removeParte(index)} className="p-1.5 text-red-500 hover:bg-red-100 rounded-full"><TrashIcon className="h-4 w-4"/></button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                ))}

                                <div className="flex flex-wrap items-center gap-2 mt-4 justify-center sm:justify-start">
                                    <button type="button" onClick={addParte} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 shadow-sm transition-all active:scale-95">
                                        <ArchiveBoxIcon className="h-4 w-4 text-gray-500"/> Item
                                    </button>
                                    <button type="button" onClick={addService} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 shadow-sm transition-all active:scale-95">
                                        <WrenchScrewdriverIcon className="h-4 w-4"/> Servicio
                                    </button>
                                    <button type="button" onClick={addCategory} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800 rounded-lg hover:bg-orange-100 dark:hover:bg-orange-900/50 shadow-sm transition-all active:scale-95">
                                        <TagIcon className="h-4 w-4"/> Categoría
                                    </button>
                                </div>
                            </div>
                        </div>

                        {isEditMode && pagos.length > 0 && (
                            <div>
                                <h3 className="text-md font-semibold text-taller-dark dark:text-taller-light mb-2 border-t dark:border-gray-600 pt-4">Historial de Pagos</h3>
                                <div className="space-y-2">
                                    {pagos.map((pago, index) => (
                                        <div key={index} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-2 bg-taller-light dark:bg-gray-700/50 rounded-md border dark:border-gray-600">
                                            {editingPaymentIndex === index ? (
                                                // Modo Edición
                                                <div className="w-full flex flex-col gap-2">
                                                    <div className="flex gap-2 items-center">
                                                        <span className="text-xs font-bold text-gray-500">Monto:</span>
                                                        <input 
                                                            type="text" 
                                                            value={editingPaymentAmount}
                                                            onChange={(e) => setEditingPaymentAmount(formatCurrency(e.target.value))}
                                                            className="flex-1 px-2 py-1 text-sm border dark:border-gray-500 rounded dark:bg-gray-600"
                                                        />
                                                    </div>
                                                    <div className="flex gap-1 justify-between bg-white dark:bg-gray-800 p-1 rounded border dark:border-gray-600">
                                                        <button 
                                                            type="button"
                                                            onClick={() => setEditingPaymentType('items')}
                                                            className={`flex-1 py-1 px-1 text-[10px] rounded transition-colors flex items-center justify-center gap-1 ${editingPaymentType === 'items' ? 'bg-blue-100 text-blue-700 font-bold border border-blue-200' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                                                        >
                                                            <ArchiveBoxIcon className="h-3 w-3" /> Repuestos
                                                        </button>
                                                        <button 
                                                            type="button"
                                                            onClick={() => setEditingPaymentType('labor')}
                                                            className={`flex-1 py-1 px-1 text-[10px] rounded transition-colors flex items-center justify-center gap-1 ${editingPaymentType === 'labor' ? 'bg-blue-100 text-blue-700 font-bold border border-blue-200' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                                                        >
                                                            <WrenchScrewdriverIcon className="h-3 w-3" /> M. Obra
                                                        </button>
                                                        <button 
                                                            type="button"
                                                            onClick={() => setEditingPaymentType(undefined)}
                                                            className={`flex-1 py-1 px-1 text-[10px] rounded transition-colors flex items-center justify-center gap-1 ${!editingPaymentType ? 'bg-blue-100 text-blue-700 font-bold border border-blue-200' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                                                        >
                                                            Gral.
                                                        </button>
                                                    </div>
                                                    <div className="flex justify-end gap-2 mt-1">
                                                        <button type="button" onClick={deleteEditingPayment} className="text-red-500 text-xs font-semibold hover:underline px-2">Eliminar</button>
                                                        <button type="button" onClick={cancelEditingPayment} className="text-gray-500 text-xs font-semibold hover:underline px-2">Cancelar</button>
                                                        <button type="button" onClick={saveEditingPayment} className="bg-green-500 text-white text-xs px-3 py-1 rounded hover:bg-green-600 flex items-center gap-1"><CheckIcon className="h-3 w-3"/> Guardar</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                // Modo Visualización
                                                <>
                                                    <div>
                                                        <p className="font-semibold text-green-600 dark:text-green-500">{new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(pago.precioUnitario)}</p>
                                                        <p className="text-xs text-taller-gray dark:text-gray-400">
                                                            {new Date(pago.fecha!).toLocaleDateString('es-ES')} 
                                                            <span className="ml-1 opacity-75 italic">
                                                                ({pago.paymentType === 'items' ? 'Repuestos' : pago.paymentType === 'labor' ? 'Mano de Obra' : 'General'})
                                                            </span>
                                                        </p>
                                                    </div>
                                                    <button type="button" onClick={() => startEditingPayment(index)} className="p-2 text-taller-gray hover:text-taller-secondary dark:text-gray-400 dark:hover:text-white rounded-full">
                                                        <PencilIcon className="h-4 w-4"/>
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end items-center pt-4 border-t dark:border-gray-700">
                            <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-xl text-right w-full sm:w-auto">
                                <p className="text-xs uppercase font-bold text-taller-gray dark:text-gray-400">{status === JobStatus.Presupuesto ? 'Total Estimado' : 'Total a Cobrar'}</p>
                                <p className="text-3xl font-bold text-taller-primary dark:text-blue-400 mt-1">{new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(costoEstimado)}</p>
                            </div>
                        </div>
                        
                        {error && <p className="text-sm text-red-600 text-center font-medium bg-red-50 dark:bg-red-900/20 p-2 rounded-lg">{error}</p>}
                    </form>
                </div>

                {/* Footer - Fixed on Mobile, Part of Card on Desktop */}
                <div className="border-t dark:border-gray-700 p-4 bg-white dark:bg-gray-800 flex flex-col sm:flex-row gap-3 shrink-0 z-10 safe-area-bottom">
                     {isEditMode ? (
                        <div className="w-full sm:flex-1 order-2 sm:order-1">
                            {!confirmingDelete ? (
                                <button
                                    type="button"
                                    onClick={() => setConfirmingDelete(true)}
                                    className="w-full flex items-center justify-center gap-2 py-3 px-4 border border-red-200 dark:border-red-900/50 rounded-xl text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 disabled:opacity-50 transition-colors"
                                >
                                    <TrashIcon className="h-5 w-5"/>
                                    Eliminar
                                </button>
                            ) : (
                                <div className="flex items-center justify-between gap-2 w-full p-1 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-900/50">
                                    <span className="text-xs font-bold text-red-600 pl-3">¿Seguro?</span>
                                    <div className="flex gap-2">
                                         <button
                                            type="button"
                                            onClick={handleDeleteJob}
                                            disabled={isDeleting}
                                            className="py-2 px-4 text-sm font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 shadow-sm"
                                        >
                                            {isDeleting ? '...' : 'Sí, Eliminar'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setConfirmingDelete(false)}
                                            disabled={isDeleting}
                                            className="py-2 px-4 text-sm font-medium text-gray-700 bg-white dark:bg-gray-700 dark:text-gray-200 rounded-lg border border-gray-200 dark:border-gray-600"
                                        >
                                            Cancelar
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : <div className="hidden sm:block sm:flex-1 order-1"></div>}
                    
                    <div className="flex gap-3 w-full sm:w-auto sm:flex-[2] order-1 sm:order-2">
                        <button 
                            type="button" 
                            onClick={onClose} 
                            className="flex-1 justify-center py-3 px-4 border border-gray-300 dark:border-gray-600 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button 
                            // Trigger form submit via ref or ID since button is outside form on mobile layout logic often
                            onClick={(e) => {
                                const form = document.getElementById('job-form') as HTMLFormElement;
                                if(form) {
                                    if(form.requestSubmit) form.requestSubmit();
                                    else form.submit();
                                }
                            }}
                            disabled={isSubmitting || isDeleting} 
                            className="flex-[2] justify-center py-3 px-6 border border-transparent rounded-xl shadow-lg shadow-taller-primary/30 text-sm font-bold text-white bg-taller-primary hover:bg-taller-secondary disabled:opacity-50 disabled:shadow-none transition-all active:scale-95"
                        >
                            {isSubmitting ? 'Guardando...' : (isEditMode ? 'Guardar Cambios' : 'Crear')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    return createPortal(
        <>
            {modalContent}
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
                .safe-area-bottom {
                    padding-bottom: calc(env(safe-area-inset-bottom) + 32px);
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

export default CrearTrabajoModal;
