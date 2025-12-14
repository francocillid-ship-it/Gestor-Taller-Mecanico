import React, { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../supabaseClient';
import type { Cliente, Parte, Trabajo } from '../types';
import { JobStatus } from '../types';
import { XMarkIcon, TrashIcon, UserPlusIcon, WrenchScrewdriverIcon, TagIcon, ArchiveBoxIcon, Bars3Icon, ShoppingBagIcon, CheckIcon, PencilIcon } from '@heroicons/react/24/solid';
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
    cantidad: number | ''; 
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
    const [isVisible, setIsVisible] = useState(false);
    
    // Auto-focus state
    const [shouldFocusNewItem, setShouldFocusNewItem] = useState(false);
    
    // Animation exit state
    const [exitingItemIds, setExitingItemIds] = useState<Set<string>>(new Set());
    const [animatedItemIds, setAnimatedItemIds] = useState<Set<string>>(new Set());
    
    // FLIP Animation Refs
    const listRef = useRef<HTMLDivElement>(null);
    const prevPositions = useRef<Map<string, number>>(new Map());

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

    const generateId = () => Math.random().toString(36).substr(2, 9);

    // --- FLIP ANIMATION LOGIC ---
    useLayoutEffect(() => {
        if (!listRef.current) return;
        
        const children = Array.from(listRef.current.children) as HTMLElement[];
        const movedItems: HTMLElement[] = [];
        
        // Disable FLIP animation for the item currently being dragged to prevent visual lag
        const draggedItemId = draggedItemIndex !== null ? partes[draggedItemIndex]?._id : null;

        children.forEach(child => {
            const id = child.dataset.id;
            if (!id || id === draggedItemId) return;
            
            const oldTop = prevPositions.current.get(id);
            const newTop = child.offsetTop; // Relative to container
            
            if (oldTop !== undefined && oldTop !== newTop) {
                const dy = oldTop - newTop;
                if (Math.abs(dy) > 0) {
                    child.style.transform = `translateY(${dy}px)`;
                    child.style.transition = 'none';
                    child.style.zIndex = '10'; 
                    movedItems.push(child);
                }
            }
        });

        if (movedItems.length > 0) {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    movedItems.forEach(child => {
                        child.style.transform = '';
                        child.style.transition = 'transform 300ms cubic-bezier(0.2, 0.8, 0.2, 1)';
                    });
                    setTimeout(() => {
                        movedItems.forEach(child => {
                            child.style.transform = '';
                            child.style.transition = '';
                            child.style.zIndex = '';
                        });
                    }, 300);
                });
            });
        }

        const newPositions = new Map<string, number>();
        children.forEach(child => {
            const id = child.dataset.id;
            if (id) {
                newPositions.set(id, child.offsetTop);
            }
        });
        prevPositions.current = newPositions;

    }, [partes, draggedItemIndex]);

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

            // Si hay un costo de mano de obra antiguo pero no hay items de servicio, lo agregamos como un item
            if (!hasServices && legacyLabor > 0) {
                processedPartes.push({
                    _id: generateId(),
                    nombre: 'Mano de Obra (General)',
                    cantidad: 1,
                    precioUnitario: formatNumberToCurrency(legacyLabor),
                    isService: true,
                    isCategory: false,
                    maintenanceType: '',
                    clientPaidDirectly: false
                });
            }

            setPartes(processedPartes);
            setAnimatedItemIds(new Set(processedPartes.map(p => p._id)));
            
            setPagos(trabajoToEdit.partes.filter(p => p.nombre === '__PAGO_REGISTRADO__'));
            setStatus(trabajoToEdit.status);
        } else if (initialClientId) {
            setSelectedClienteId(initialClientId);
            // Lógica de polling para asegurar que el cliente recién creado tenga sus vehículos cargados
            const fetchVehicleData = async () => {
                let attempts = 0;
                while (attempts < 15) { 
                    const { data } = await supabase
                        .from('clientes')
                        .select('*, vehiculos(*)')
                        .eq('id', initialClientId)
                        .maybeSingle();
                    
                    if (data && data.vehiculos && data.vehiculos.length > 0) {
                        const clientData = data as Cliente;
                        setLocalNewClient(clientData);
                        setSelectedClienteId(clientData.id); 
                        const lastVehicle = clientData.vehiculos[clientData.vehiculos.length - 1];
                        setSelectedVehiculoId(lastVehicle.id);
                        return;
                    }
                    await new Promise(r => setTimeout(r, 500));
                    attempts++;
                }
                const existing = clientes.find(c => c.id === initialClientId);
                if (existing && existing.vehiculos && existing.vehiculos.length > 0) {
                     const lastVehicle = existing.vehiculos[existing.vehiculos.length - 1];
                     setSelectedVehiculoId(lastVehicle.id);
                }
            };
            fetchVehicleData();
        } else {
            // Default empty row
             setPartes([{ _id: generateId(), nombre: '', cantidad: 1, precioUnitario: '', isService: false, maintenanceType: '' }]);
        }
        requestAnimationFrame(() => setIsVisible(true));
    }, [trabajoToEdit, initialClientId]);

    // AUTO-FOCUS EFFECT
    useEffect(() => {
        if (shouldFocusNewItem && partes.length > 0) {
            const lastIndex = partes.length - 1;
            const inputId = `parte-nombre-${lastIndex}`;
            setTimeout(() => {
                const inputElement = document.getElementById(inputId);
                if (inputElement) {
                    inputElement.focus({ preventScroll: true });
                    inputElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 150);
            setShouldFocusNewItem(false);
        }
    }, [partes, shouldFocusNewItem]);

    const handleClose = () => {
        setIsVisible(false);
        setTimeout(onClose, 300);
    };

    const handleClientCreated = async (newClient?: Cliente) => {
        setIsClientModalOpen(false);
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
        setShouldFocusNewItem(true);
    };
    
    const addService = () => {
        setPartes([...partes, { _id: generateId(), nombre: '', cantidad: 1, precioUnitario: '', isService: true, maintenanceType: '' }]);
        setShouldFocusNewItem(true);
    };
    
    const addCategory = () => {
        setPartes([...partes, { _id: generateId(), nombre: '', cantidad: 0, precioUnitario: '', isCategory: true }]);
        setShouldFocusNewItem(true);
    };

    const removeParte = (index: number) => {
        const itemToRemove = partes[index];
        if (!itemToRemove) return;
        setExitingItemIds(prev => new Set(prev).add(itemToRemove._id));
        setTimeout(() => {
            setPartes(currentPartes => currentPartes.filter((_, i) => i !== index));
            setExitingItemIds(prev => {
                const next = new Set(prev);
                next.delete(itemToRemove._id);
                return next;
            });
        }, 300);
    };

    const handleAnimationEnd = (id: string) => {
        setAnimatedItemIds(prev => new Set(prev).add(id));
    };

    // Drag and Drop
    const handleDragStart = (index: number) => setDraggedItemIndex(index);
    const handleDragEnter = (index: number) => {
        if (draggedItemIndex === null || draggedItemIndex === index) return;
        const newPartes = [...partes];
        const item = newPartes[draggedItemIndex];
        newPartes.splice(draggedItemIndex, 1);
        newPartes.splice(index, 0, item);
        setPartes(newPartes);
        setDraggedItemIndex(index);
    };
    const handleDragEnd = () => setDraggedItemIndex(null);

    // Touch Drag - Logic Fixed: Use Closest Center instead of Intersection
    const handleTouchStart = (index: number) => setDraggedItemIndex(index);
    
    const handleTouchMove = (e: React.TouchEvent) => {
        if (draggedItemIndex === null || !listRef.current) return;
        e.preventDefault(); // Prevent scrolling while dragging
        
        const touch = e.touches[0];
        const clientY = touch.clientY;
        const children = Array.from(listRef.current.children) as HTMLElement[];
        
        let closestIndex = -1;
        let minDistance = Number.MAX_VALUE;

        // "Closest Center" algorithm:
        // Finds which item's vertical center is closest to the finger.
        // This is robust against margins, gaps, and varying item heights.
        children.forEach((child) => {
            const rect = child.getBoundingClientRect();
            const centerY = rect.top + (rect.height / 2);
            const distance = Math.abs(clientY - centerY);
            
            // Check if this child has a valid data-index
            const indexAttr = child.getAttribute('data-index');
            if (indexAttr !== null && distance < minDistance) {
                minDistance = distance;
                closestIndex = parseInt(indexAttr, 10);
            }
        });

        // Swap if we found a valid target and it's different from current
        if (closestIndex !== -1 && closestIndex !== draggedItemIndex) {
             const newPartes = [...partes];
             const item = newPartes[draggedItemIndex];
             
             // 1. Remove from old position
             newPartes.splice(draggedItemIndex, 1);
             // 2. Insert at new position
             newPartes.splice(closestIndex, 0, item);
             
             setPartes(newPartes);
             setDraggedItemIndex(closestIndex);
        }
    };
    
    const handleTouchEnd = () => setDraggedItemIndex(null);
    
    // Payment editing handlers...
    const startEditingPayment = (index: number) => {
        const pago = pagos[index];
        setEditingPaymentIndex(index);
        setEditingPaymentAmount(formatNumberToCurrency(pago.precioUnitario));
        setEditingPaymentType(pago.paymentType);
    };
    const saveEditingPayment = () => {
        if (editingPaymentIndex === null) return;
        const newPagos = [...pagos];
        newPagos[editingPaymentIndex] = { ...newPagos[editingPaymentIndex], precioUnitario: parseCurrency(editingPaymentAmount), paymentType: editingPaymentType };
        setPagos(newPagos);
        cancelEditingPayment();
    };
    const cancelEditingPayment = () => { setEditingPaymentIndex(null); setEditingPaymentAmount(''); setEditingPaymentType(undefined); };
    const deleteEditingPayment = () => { if (editingPaymentIndex === null) return; setPagos(p => p.filter((_, i) => i !== editingPaymentIndex)); cancelEditingPayment(); };

    const handleDeleteJob = async () => {
        if (!trabajoToEdit) return;
        setIsDeleting(true);
        try {
            const { error: deleteError } = await supabase.from('trabajos').delete().eq('id', trabajoToEdit.id);
            if (deleteError) throw deleteError;
            onDataRefresh();
            setIsVisible(false);
            setTimeout(() => onSuccess(), 300);
        } catch (err: any) {
            setError(err.message || 'Error al eliminar el trabajo.');
            setIsDeleting(false);
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
                costo_mano_de_obra: calculatedManoDeObra, // Automatically calculated from items
                costo_estimado: costoEstimado,
                status: status,
                fecha_entrada: trabajoToEdit?.fechaEntrada || new Date().toISOString(),
                kilometraje: kmValue,
            };

            if (isEditMode) {
                const { error: updateError } = await supabase.from('trabajos').update(jobData).eq('id', trabajoToEdit!.id);
                if (updateError) throw updateError;
            } else {
                const { error: insertError } = await supabase.from('trabajos').insert(jobData);
                if (insertError) throw insertError;
            }

            localStorage.removeItem('pending_job_client_id');
            setIsVisible(false);
            setTimeout(() => onSuccess(), 300);
        } catch (err: any) {
            setError(err.message || 'Error al guardar el trabajo.');
            setIsSubmitting(false);
        } 
    };

    return createPortal(
        <>
            <div className="fixed inset-0 z-[100] flex justify-center items-end sm:items-center sm:p-4">
                 <div 
                    className={`fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ease-out ${isVisible ? 'opacity-100' : 'opacity-0'}`} 
                    onClick={handleClose}
                />
                <div 
                    className={`bg-white dark:bg-gray-800 w-full h-[100dvh] sm:h-auto sm:max-h-[90vh] sm:max-w-3xl sm:rounded-xl shadow-2xl flex flex-col overflow-hidden relative z-10 transform transition-all duration-300 ease-out ${isVisible ? 'translate-y-0 opacity-100 sm:scale-100' : 'translate-y-full opacity-0 sm:translate-y-0 sm:scale-95'}`}
                >
                    {/* Header */}
                    <div className="flex justify-between items-center p-4 border-b dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
                        <h2 className="text-lg sm:text-xl font-bold text-taller-dark dark:text-taller-light truncate pr-4">
                            {isEditMode ? 'Editar Trabajo' : 'Crear Nuevo Presupuesto'}
                        </h2>
                        <button onClick={handleClose} className="p-2 -mr-2 text-taller-gray dark:text-gray-400 hover:text-taller-dark dark:hover:text-white rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                            <XMarkIcon className="h-6 w-6" />
                        </button>
                    </div>
                    
                    {/* Content */}
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
                                    <select id="cliente" value={selectedClienteId} onChange={e => setSelectedClienteId(e.target.value)} className="block w-full px-3 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-taller-primary focus:border-taller-primary sm:text-sm" required>
                                        <option value="">Seleccione un cliente</option>
                                        {mergedClientes.map(c => <option key={c.id} value={c.id}>{`${c.nombre} ${c.apellido || ''}`.trim()}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="vehiculo" className="block text-sm font-medium text-taller-gray dark:text-gray-400 mb-1">Vehículo</label>
                                    <select id="vehiculo" value={selectedVehiculoId} onChange={e => setSelectedVehiculoId(e.target.value)} disabled={!selectedClienteId} className="block w-full px-3 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-taller-primary focus:border-taller-primary sm:text-sm disabled:bg-gray-100 dark:disabled:bg-gray-700/50 disabled:text-gray-400" required>
                                        <option value="">Seleccione un vehículo</option>
                                        {selectedClientVehiculos.map(v => <option key={v.id} value={v.id}>{`${v.marca} ${v.modelo} (${v.matricula})`}</option>)}
                                    </select>
                                </div>
                            </div>

                             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                 <div className="md:col-span-2">
                                    <label htmlFor="descripcion" className="block text-sm font-medium text-taller-gray dark:text-gray-400 mb-1">Descripción (Opcional)</label>
                                    <textarea id="descripcion" value={descripcion} onChange={e => setDescripcion(e.target.value)} rows={2} className="block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-taller-primary focus:border-taller-primary sm:text-sm" />
                                </div>
                                 <div>
                                    <label htmlFor="kilometraje" className="block text-sm font-medium text-taller-gray dark:text-gray-400 mb-1">Kilometraje</label>
                                    <input 
                                        type="number" 
                                        id="kilometraje" 
                                        value={kilometraje} 
                                        onChange={e => setKilometraje(e.target.value)} 
                                        placeholder="Ej. 150000"
                                        className="block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-taller-primary focus:border-taller-primary sm:text-sm" 
                                    />
                                </div>
                            </div>

                            {isEditMode && (
                                <div>
                                    <label htmlFor="status" className="block text-sm font-medium text-taller-gray dark:text-gray-400 mb-1">Estado</label>
                                    <select id="status" value={status} onChange={e => setStatus(e.target.value as JobStatus)} className="block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-taller-primary focus:border-taller-primary sm:text-sm">
                                        {Object.values(JobStatus).map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                            )}

                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-md font-semibold text-taller-dark dark:text-taller-light">Items y Servicios</h3>
                                </div>
                                
                                <div className="flex flex-col relative" ref={listRef}>
                                    {partes.map((parte, index) => {
                                        const isExiting = exitingItemIds.has(parte._id);
                                        const hasAnimated = animatedItemIds.has(parte._id);
                                        const isDraggingGlobal = draggedItemIndex !== null;
                                        
                                        let animationClass = '';
                                        if (isExiting) {
                                            animationClass = 'animate-slide-out-right';
                                        } else if (!hasAnimated && !isDraggingGlobal) {
                                            animationClass = 'animate-entry-expand';
                                        }

                                        return (
                                        <div 
                                            key={parte._id}
                                            data-index={index}
                                            data-id={parte._id}
                                            onAnimationEnd={() => handleAnimationEnd(parte._id)}
                                            className={`flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2 mb-3 rounded-lg border dark:border-gray-700 transition-colors duration-300 ease-out select-none 
                                                ${draggedItemIndex === index ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 opacity-50' : 'bg-gray-50 dark:bg-gray-700/30'}
                                                ${animationClass}`}
                                            style={{ WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none' }}
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
                                                        onContextMenu={(e) => e.preventDefault()}
                                                    >
                                                        <Bars3Icon className="h-5 w-5"/>
                                                    </div>
                                                    <TagIcon className="h-5 w-5 text-taller-accent flex-shrink-0"/>
                                                    <input 
                                                        type="text" 
                                                        id={`parte-nombre-${index}`}
                                                        placeholder="Nombre de la categoría" 
                                                        value={parte.nombre} 
                                                        onChange={e => handleParteChange(index, 'nombre', e.target.value)} 
                                                        className="flex-grow min-w-0 px-3 py-2 bg-transparent border-b border-transparent focus:border-taller-primary focus:outline-none font-semibold text-taller-dark dark:text-taller-light select-text" 
                                                    />
                                                    <button 
                                                        type="button" 
                                                        onClick={() => handleParteChange(index, 'clientPaidDirectly', !parte.clientPaidDirectly)}
                                                        className={`p-2 rounded-full transition-colors ${parte.clientPaidDirectly ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-300' : 'text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                                                        title="Marcar categoría pagada por el cliente"
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
                                                            onContextMenu={(e) => e.preventDefault()}
                                                        >
                                                            <Bars3Icon className="h-5 w-5"/>
                                                        </div>
                                                        <div className={`p-1.5 rounded-md flex-shrink-0 ${parte.isService ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-600'}`}>
                                                            {parte.isService ? <WrenchScrewdriverIcon className="h-4 w-4"/> : <ArchiveBoxIcon className="h-4 w-4"/>}
                                                        </div>
                                                        <input 
                                                            type="text" 
                                                            id={`parte-nombre-${index}`}
                                                            placeholder={parte.isService ? "Servicio" : "Repuesto"}
                                                            value={parte.nombre}
                                                            onChange={e => handleParteChange(index, 'nombre', e.target.value)}
                                                            className={`flex-grow min-w-0 px-2 py-1 bg-transparent focus:outline-none text-sm font-medium select-text ${parte.clientPaidDirectly ? 'line-through text-gray-400' : ''}`}
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
                                                    
                                                    {/* Mobile Row Layout: Controls (Qty, Price, Type, Tag) */}
                                                    <div className="flex items-center gap-2 w-full sm:hidden pl-8">
                                                         <input 
                                                            type="number" 
                                                            placeholder="#" 
                                                            value={parte.cantidad} 
                                                            onChange={e => {
                                                                const val = e.target.value;
                                                                handleParteChange(index, 'cantidad', val === '' ? '' : parseInt(val, 10));
                                                            }}
                                                            className={`w-12 px-2 py-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-center text-sm select-text ${parte.clientPaidDirectly ? 'opacity-50' : ''}`}
                                                        />
                                                         <input 
                                                            type="text" 
                                                            inputMode="decimal" 
                                                            placeholder="$ 0" 
                                                            value={parte.precioUnitario} 
                                                            onChange={e => handleParteChange(index, 'precioUnitario', formatCurrency(e.target.value))} 
                                                            className={`flex-1 min-w-0 px-2 py-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-sm text-right select-text ${parte.clientPaidDirectly ? 'opacity-50 line-through' : ''}`} 
                                                        />
                                                        <select
                                                            value={parte.maintenanceType || ''}
                                                            onChange={e => handleParteChange(index, 'maintenanceType', e.target.value)}
                                                            className="flex-[1.5] min-w-0 px-2 py-1 text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-taller-dark dark:text-taller-light focus:outline-none focus:ring-1 focus:ring-taller-primary"
                                                        >
                                                            <option value="">Etiqueta...</option>
                                                            {ALL_MAINTENANCE_OPTS.map(opt => <option key={opt.key} value={opt.key}>{opt.label}</option>)}
                                                        </select>
                                                    </div>

                                                    {/* Desktop Layout (Grid) */}
                                                    <div className="hidden sm:grid sm:grid-cols-[auto_auto_1fr_130px_70px_100px_auto_auto] items-center gap-2 w-full">
                                                        <div className="cursor-move text-gray-400 hover:text-taller-primary" onDragStart={() => handleDragStart(index)}><Bars3Icon className="h-5 w-5"/></div>
                                                        <div title={parte.isService ? "Servicio" : "Repuesto"} className={`p-1.5 rounded ${parte.isService ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-600'}`}>
                                                            {parte.isService ? <WrenchScrewdriverIcon className="h-4 w-4"/> : <ArchiveBoxIcon className="h-4 w-4"/>}
                                                        </div>
                                                        <input 
                                                            type="text" 
                                                            id={`parte-nombre-desktop-${index}`}
                                                            value={parte.nombre} 
                                                            onChange={e => handleParteChange(index, 'nombre', e.target.value)} 
                                                            className={`w-full px-2 py-1 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded text-sm focus:outline-none focus:ring-1 focus:ring-taller-primary select-text ${parte.clientPaidDirectly ? 'line-through text-gray-400' : ''}`}
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
                                                            className={`w-full px-2 py-1 text-center bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded text-sm focus:outline-none focus:ring-1 focus:ring-taller-primary select-text ${parte.clientPaidDirectly ? 'opacity-50' : ''}`} 
                                                        />
                                                        <input 
                                                            type="text" 
                                                            value={parte.precioUnitario} 
                                                            onChange={e => handleParteChange(index, 'precioUnitario', formatCurrency(e.target.value))} 
                                                            className={`w-full px-2 py-1 text-right bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded text-sm focus:outline-none focus:ring-1 focus:ring-taller-primary select-text ${parte.clientPaidDirectly ? 'opacity-50 line-through' : ''}`} 
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
                                        );
                                    })}

                                    <div className="flex flex-wrap items-center gap-2 mt-4 justify-center sm:justify-start">
                                        <button type="button" onClick={addParte} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 shadow-sm transition-all active:scale-95">
                                            <ArchiveBoxIcon className="h-4 w-4 text-gray-500"/> Ítem
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
                                            <div key={index} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-2 bg-taller-light dark:bg-gray-700/50 rounded-lg border dark:border-gray-700">
                                                <div className="flex-1 w-full sm:w-auto">
                                                    <p className="text-sm text-taller-dark dark:text-gray-300">
                                                        Pago del {new Date(pago.fecha!).toLocaleDateString('es-ES')}
                                                        <span className="text-xs text-gray-500 ml-2">
                                                            ({pago.paymentType === 'items' ? 'Repuestos' : pago.paymentType === 'labor' ? 'Mano de Obra' : 'General'})
                                                        </span>
                                                    </p>
                                                </div>
                                                <div className="flex items-center justify-between w-full sm:w-auto gap-4 mt-1 sm:mt-0">
                                                    {editingPaymentIndex === index ? (
                                                        <>
                                                            <div className="flex gap-2">
                                                                <input
                                                                    type="text"
                                                                    value={editingPaymentAmount}
                                                                    onChange={e => setEditingPaymentAmount(formatCurrency(e.target.value))}
                                                                    className="w-24 px-2 py-1 text-sm border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-right"
                                                                />
                                                                <select 
                                                                    value={editingPaymentType || ''} 
                                                                    onChange={e => setEditingPaymentType(e.target.value as any)}
                                                                    className="text-xs px-1 border dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                                                                >
                                                                    <option value="">Gral.</option>
                                                                    <option value="items">Rep.</option>
                                                                    <option value="labor">M.O.</option>
                                                                </select>
                                                            </div>
                                                            <div className="flex gap-1">
                                                                <button onClick={saveEditingPayment} className="text-green-600 hover:text-green-800 dark:hover:text-green-400"><CheckIcon className="h-5 w-5"/></button>
                                                                <button onClick={cancelEditingPayment} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"><XMarkIcon className="h-5 w-5"/></button>
                                                                <button onClick={deleteEditingPayment} className="text-red-600 hover:text-red-800 dark:hover:text-red-400"><TrashIcon className="h-5 w-5"/></button>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <span className="font-bold text-green-600 dark:text-green-400">{formatNumberToCurrency(pago.precioUnitario)}</span>
                                                            <button onClick={() => startEditingPayment(index)} className="text-taller-gray hover:text-taller-secondary dark:hover:text-white p-1">
                                                                <PencilIcon className="h-4 w-4" />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-between items-center pt-2 border-t dark:border-gray-700">
                                <span className="font-bold text-taller-dark dark:text-taller-light text-lg">Total Estimado:</span>
                                <span className="font-bold text-taller-primary text-xl">
                                    {formatNumberToCurrency(costoEstimado)}
                                </span>
                            </div>
                            
                            {error && <p className="text-sm text-red-600">{error}</p>}
                        </form>
                    </div>

                    {/* Footer Actions */}
                    <div className="border-t dark:border-gray-700 p-4 bg-white dark:bg-gray-800 flex gap-3 shrink-0 z-10 safe-area-bottom">
                        {isEditMode && !confirmingDelete && (
                            <button type="button" onClick={() => setConfirmingDelete(true)} className="flex items-center justify-center p-3 text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-800 rounded-xl transition-colors">
                                <TrashIcon className="h-5 w-5"/>
                            </button>
                        )}
                        {confirmingDelete && (
                            <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-2">
                                <span className="text-xs font-bold text-red-600 pl-1">¿Borrar?</span>
                                <button type="button" onClick={handleDeleteJob} disabled={isDeleting} className="py-1 px-2 text-xs font-bold text-white bg-red-600 rounded hover:bg-red-700">{isDeleting ? '...' : 'Sí'}</button>
                                <button type="button" onClick={() => setConfirmingDelete(false)} disabled={isDeleting} className="py-1 px-2 text-xs text-gray-700 bg-white dark:bg-gray-700 border border-gray-300 rounded">No</button>
                            </div>
                        )}
                        <button type="button" onClick={handleClose} className="flex-1 py-3 px-4 border border-gray-300 dark:border-gray-600 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">
                            Cancelar
                        </button>
                        <button type="button" onClick={() => {
                            const form = document.getElementById('job-form') as HTMLFormElement;
                            if (form) form.requestSubmit();
                        }} disabled={isSubmitting} className="flex-[2] py-3 px-6 border border-transparent rounded-xl shadow-lg shadow-taller-primary/30 text-sm font-bold text-white bg-taller-primary hover:bg-taller-secondary disabled:opacity-50 disabled:shadow-none transition-all active:scale-95">
                            {isSubmitting ? 'Guardando...' : (isEditMode ? 'Guardar Cambios' : 'Crear Presupuesto')}
                        </button>
                    </div>
                </div>
            </div>

            {isClientModalOpen && (
                <CrearClienteModal
                    onClose={() => setIsClientModalOpen(false)}
                    onSuccess={handleClientCreated}
                />
            )}
             <style>{`
                .safe-area-bottom {
                    padding-bottom: calc(env(safe-area-inset-bottom) + 16px);
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