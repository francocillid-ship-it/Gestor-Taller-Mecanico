
import React, { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase, supabaseUrl, supabaseKey } from '../supabaseClient';
import { createClient } from '@supabase/supabase-js';
import type { Cliente, Parte, Trabajo, Vehiculo } from '../types';
import { JobStatus } from '../types';
import { XMarkIcon, TrashIcon, UserPlusIcon, WrenchScrewdriverIcon, TagIcon, ArchiveBoxIcon, Bars3Icon, ShoppingBagIcon, CheckIcon, PencilIcon, BoltIcon, UsersIcon, BeakerIcon } from '@heroicons/react/24/solid';
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
    _id: string; 
    nombre: string;
    cantidad: number | ''; 
    precioUnitario: string; 
    isCategory?: boolean;
    isService?: boolean;
    maintenanceType?: string;
    clientPaidDirectly?: boolean;
};

const CrearTrabajoModal: React.FC<CrearTrabajoModalProps> = ({ onClose, onSuccess, onDataRefresh, clientes, trabajoToEdit, initialClientId }) => {
    // UI State
    const [creationMode, setCreationMode] = useState<'existing' | 'quick'>(trabajoToEdit?.isQuickBudget ? 'quick' : 'existing');
    
    // Quick Budget Specific State
    const [quickNombre, setQuickNombre] = useState('');
    const [quickApellido, setQuickApellido] = useState('');
    const [quickMarca, setQuickMarca] = useState('');
    const [quickModelo, setQuickModelo] = useState('');
    const [quickMatricula, setQuickMatricula] = useState('');

    // Common State
    const [selectedClienteId, setSelectedClienteId] = useState('');
    const [selectedVehiculoId, setSelectedVehiculoId] = useState('');
    const [descripcion, setDescripcion] = useState('');
    const [kilometraje, setKilometraje] = useState(''); 
    const [partes, setPartes] = useState<ParteState[]>([]);
    const [status, setStatus] = useState<JobStatus>(JobStatus.Presupuesto);
    const [pagos, setPagos] = useState<Parte[]>([]);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [confirmingDelete, setConfirmingDelete] = useState(false);
    const [error, setError] = useState('');
    const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    
    const [exitingItemIds, setExitingItemIds] = useState<Set<string>>(new Set());
    const [animatedItemIds, setAnimatedItemIds] = useState<Set<string>>(new Set());
    
    const listRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null); 
    const prevPositions = useRef<Map<string, number>>(new Map());

    const isEditMode = Boolean(trabajoToEdit);

    const mergedClientes = useMemo(() => {
        return clientes;
    }, [clientes]);

    const selectedClientVehiculos = useMemo(() => {
        const client = mergedClientes.find(c => c.id === selectedClienteId);
        return client?.vehiculos || [];
    }, [mergedClientes, selectedClienteId]);

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

    useLayoutEffect(() => {
        if (!listRef.current) return;
        const children = Array.from(listRef.current.children) as HTMLElement[];
        const movedItems: HTMLElement[] = [];
        const draggedItemId = draggedItemIndex !== null ? partes[draggedItemIndex]?._id : null;

        children.forEach(child => {
            const id = child.dataset.id;
            if (!id || id === draggedItemId) return;
            const oldTop = prevPositions.current.get(id);
            const newTop = child.offsetTop;
            if (oldTop !== undefined && oldTop !== newTop) {
                const dy = oldTop - newTop;
                child.style.transform = `translateY(${dy}px)`;
                child.style.transition = 'none';
                movedItems.push(child);
            }
        });

        if (movedItems.length > 0) {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    movedItems.forEach(child => {
                        child.style.transform = '';
                        child.style.transition = 'transform 300ms cubic-bezier(0.2, 0.8, 0.2, 1)';
                    });
                });
            });
        }

        const newPositions = new Map<string, number>();
        children.forEach(child => {
            const id = child.dataset.id;
            if (id) newPositions.set(id, child.offsetTop);
        });
        prevPositions.current = newPositions;
    }, [partes, draggedItemIndex]);

    useEffect(() => {
        if (trabajoToEdit) {
            setCreationMode(trabajoToEdit.isQuickBudget ? 'quick' : 'existing');
            if (trabajoToEdit.isQuickBudget && trabajoToEdit.quickBudgetData) {
                setQuickNombre(trabajoToEdit.quickBudgetData.nombre);
                setQuickApellido(trabajoToEdit.quickBudgetData.apellido || '');
                setQuickMarca(trabajoToEdit.quickBudgetData.marca);
                setQuickModelo(trabajoToEdit.quickBudgetData.modelo);
                setQuickMatricula(trabajoToEdit.quickBudgetData.matricula || '');
            } else {
                setSelectedClienteId(trabajoToEdit.clienteId);
                setSelectedVehiculoId(trabajoToEdit.vehiculoId);
            }
            setDescripcion(trabajoToEdit.descripcion);
            setKilometraje(trabajoToEdit.kilometraje ? String(trabajoToEdit.kilometraje) : '');
            
            const initialPartes = trabajoToEdit.partes.filter(p => p.nombre !== '__PAGO_REGISTRADO__');
            let processedPartes = initialPartes.map(p => ({
                ...p,
                _id: generateId(),
                precioUnitario: formatNumberToCurrency(p.precioUnitario),
            }));
            setPartes(processedPartes);
            setAnimatedItemIds(new Set(processedPartes.map(p => p._id)));
            setPagos(trabajoToEdit.partes.filter(p => p.nombre === '__PAGO_REGISTRADO__'));
            setStatus(trabajoToEdit.status);
        } else if (initialClientId) {
            setSelectedClienteId(initialClientId);
            setCreationMode('existing');
            setPartes([]);
        } else {
             setPartes([]);
        }
        requestAnimationFrame(() => setIsVisible(true));
    }, [trabajoToEdit, initialClientId]);

    const handleClose = () => {
        setIsVisible(false);
        setTimeout(onClose, 300);
    };

    const handleParteChange = (index: number, field: keyof ParteState, value: string | number | boolean) => {
        const newPartes = [...partes];
        (newPartes[index] as any)[field] = value;

        // Auto-tagging logic based on keywords if maintenanceType is empty
        if (field === 'nombre' && value && !newPartes[index].maintenanceType && !newPartes[index].isCategory) {
            const val = String(value).toLowerCase();
            const found = ALL_MAINTENANCE_OPTS.find(opt => 
                opt.keywords.some(k => val.includes(k))
            );
            if (found) {
                newPartes[index].maintenanceType = found.key;
            }
        }

        setPartes(newPartes);
    };

    const addParte = () => {
        setPartes([...partes, { _id: generateId(), nombre: '', cantidad: 1, precioUnitario: '', isService: false, maintenanceType: '', clientPaidDirectly: false }]);
    };
    
    const addService = () => {
        setPartes([...partes, { _id: generateId(), nombre: '', cantidad: 1, precioUnitario: '', isService: true, maintenanceType: '', clientPaidDirectly: false }]);
    };
    
    const addCategory = () => {
        setPartes([...partes, { _id: generateId(), nombre: '', cantidad: 0, precioUnitario: '', isCategory: true }]);
    };

    const removeParte = (index: number) => {
        const itemToRemove = partes[index];
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

    // --- Drag and Drop Logic (Touch Support Added) ---
    const handleDragStart = (index: number) => {
        setDraggedItemIndex(index);
    };

    const handleDragEnter = (index: number) => {
        if (draggedItemIndex === null || draggedItemIndex === index) return;
        const newPartes = [...partes];
        const item = newPartes[draggedItemIndex];
        newPartes.splice(draggedItemIndex, 1);
        newPartes.splice(index, 0, item);
        setPartes(newPartes);
        setDraggedItemIndex(index);
    };

    const handleDragEnd = () => {
        setDraggedItemIndex(null);
    };

    // Touch Support for Reordering
    const handleTouchStart = (index: number, e: React.TouchEvent) => {
        // Prevent default only if we are touching the handle
        setDraggedItemIndex(index);
        // We don't preventDefault here to allow scrolling if they just tap/swipe outside handle
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (draggedItemIndex === null) return;
        
        // Bloquear scroll mientras se arrastra
        if (e.cancelable) e.preventDefault();

        const touch = e.touches[0];
        const elementOver = document.elementFromPoint(touch.clientX, touch.clientY);
        const itemElement = elementOver?.closest('[data-id]') as HTMLElement;
        
        if (itemElement && itemElement.dataset.id) {
            const overId = itemElement.dataset.id;
            const overIndex = partes.findIndex(p => p._id === overId);
            
            if (overIndex !== -1 && overIndex !== draggedItemIndex) {
                handleDragEnter(overIndex);
            }
        }
    };

    const handleTouchEnd = () => {
        setDraggedItemIndex(null);
    };

    const handleDelete = async () => {
        if (!trabajoToEdit) return;
        setIsDeleting(true);
        try {
            const { error } = await supabase.from('trabajos').delete().eq('id', trabajoToEdit.id);
            if (error) throw error;
            setIsVisible(false);
            setTimeout(() => onSuccess(), 300);
        } catch (err: any) {
            setError(err.message || 'Error al eliminar el trabajo.');
            setIsDeleting(false);
            setConfirmingDelete(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (creationMode === 'existing' && (!selectedClienteId || !selectedVehiculoId)) {
            setError('Por favor, seleccione un cliente y un vehículo.');
            return;
        }

        if (creationMode === 'quick' && (!quickNombre || !quickMarca || !quickModelo)) {
            setError('Complete nombre, marca y modelo para el presupuesto rápido.');
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

            let finalClienteId: string | null = selectedClienteId || null;
            let finalVehiculoId: string | null = selectedVehiculoId || null;

            // Convert quick budget to real client if it moves past budget status
            if (creationMode === 'quick' && (status === JobStatus.EnProceso || status === JobStatus.Programado)) {
                const { data: newClient, error: cErr } = await supabase.from('clientes').insert({
                    taller_id: user.id,
                    nombre: quickNombre,
                    apellido: quickApellido,
                    email: `${crypto.randomUUID()}@quick-taller.com`,
                    telefono: ''
                }).select().single();

                if (cErr) throw cErr;

                const { data: newVeh, error: vErr } = await supabase.from('vehiculos').insert({
                    cliente_id: newClient.id,
                    marca: quickMarca.toUpperCase(),
                    modelo: quickModelo.toUpperCase(),
                    matricula: quickMatricula.toUpperCase()
                }).select().single();

                if (vErr) throw vErr;

                finalClienteId = newClient.id;
                finalVehiculoId = newVeh.id;
            }

            const expirationDate = new Date();
            expirationDate.setDate(expirationDate.getDate() + 30);

            const jobData: any = {
                cliente_id: finalClienteId,
                vehiculo_id: finalVehiculoId, 
                taller_id: user.id,
                descripcion,
                partes: [...cleanPartes, ...pagos],
                costo_mano_de_obra: calculatedManoDeObra,
                costo_estimado: cleanPartes.filter(p => !p.isCategory && !p.clientPaidDirectly).reduce((s, p) => s + (p.cantidad * p.precioUnitario), 0),
                status: status,
                fecha_entrada: trabajoToEdit?.fechaEntrada || new Date().toISOString(),
                kilometraje: kmValue,
                is_quick_budget: creationMode === 'quick' && status === JobStatus.Presupuesto,
                quick_budget_data: creationMode === 'quick' ? {
                    nombre: quickNombre,
                    apellido: quickApellido,
                    marca: quickMarca,
                    modelo: quickModelo,
                    matricula: quickMatricula
                } : null,
                expires_at: creationMode === 'quick' && status === JobStatus.Presupuesto ? expirationDate.toISOString() : null
            };

            if (isEditMode) {
                const { error: updateError } = await supabase.from('trabajos').update(jobData).eq('id', trabajoToEdit!.id);
                if (updateError) throw updateError;
            } else {
                const { error: insertError } = await supabase.from('trabajos').insert(jobData);
                if (insertError) throw insertError;
            }

            setIsVisible(false);
            setTimeout(() => onSuccess(), 300);
        } catch (err: any) {
            setError(err.message || 'Error al guardar el trabajo.');
            setIsSubmitting(false);
        } 
    };

    return createPortal(
        <div className="fixed inset-0 z-[100] flex justify-center items-end sm:items-center sm:p-4">
            <div className={`fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`} onClick={handleClose}/>
            <div className={`bg-white dark:bg-gray-800 w-full h-[100dvh] sm:h-auto sm:max-h-[90vh] sm:max-w-3xl sm:rounded-xl shadow-2xl flex flex-col overflow-hidden relative z-10 transform transition-all duration-300 ease-out ${isVisible ? 'translate-y-0' : 'translate-y-full'}`}>
                
                {/* Header Mode Selector */}
                <div className="bg-gray-100 dark:bg-gray-900 p-1 flex-shrink-0">
                    <div className="flex bg-white dark:bg-gray-800 rounded-lg p-1 gap-1">
                        <button 
                            type="button"
                            onClick={() => !isEditMode && setCreationMode('existing')}
                            disabled={isEditMode}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold rounded-md transition-all ${creationMode === 'existing' ? 'bg-taller-primary text-white shadow-md' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50'}`}
                        >
                            <UsersIcon className="h-4 w-4" /> Cliente Existente
                        </button>
                        <button 
                            type="button"
                            onClick={() => !isEditMode && setCreationMode('quick')}
                            disabled={isEditMode}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold rounded-md transition-all ${creationMode === 'quick' ? 'bg-taller-primary text-white shadow-md' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50'}`}
                        >
                            <BoltIcon className="h-4 w-4" /> Presupuesto Rápido
                        </button>
                    </div>
                </div>

                <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar">
                    <form id="job-form" onSubmit={handleSubmit} className="space-y-5 pb-40 sm:pb-0">
                        
                        {creationMode === 'existing' ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-300">
                                <div>
                                    <label className="block text-sm font-medium text-taller-gray mb-1">Cliente</label>
                                    <select value={selectedClienteId} onChange={e => setSelectedClienteId(e.target.value)} className="block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm" required>
                                        <option value="">Seleccione...</option>
                                        {mergedClientes.map(c => <option key={c.id} value={c.id}>{`${c.nombre} ${c.apellido || ''}`}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-taller-gray mb-1">Vehículo</label>
                                    <select value={selectedVehiculoId} onChange={e => setSelectedVehiculoId(e.target.value)} disabled={!selectedClienteId} className="block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm">
                                        <option value="">Seleccione...</option>
                                        {selectedClientVehiculos.map(v => <option key={v.id} value={v.id}>{`${v.marca} ${v.modelo}`}</option>)}
                                    </select>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                                <div className="grid grid-cols-2 gap-4">
                                    <input type="text" value={quickNombre} onChange={e => setQuickNombre(e.target.value)} placeholder="Nombre del Cliente" className="px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600 focus:ring-1 focus:ring-taller-primary outline-none" required />
                                    <input type="text" value={quickApellido} onChange={e => setQuickApellido(e.target.value)} placeholder="Apellido (opcional)" className="px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600 focus:ring-1 focus:ring-taller-primary outline-none" />
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                    <input type="text" value={quickMarca} onChange={e => setQuickMarca(e.target.value.toUpperCase())} placeholder="MARCA" className="px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600 focus:ring-1 focus:ring-taller-primary outline-none" required />
                                    <input type="text" value={quickModelo} onChange={e => setQuickModelo(e.target.value.toUpperCase())} placeholder="MODELO" className="px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600 focus:ring-1 focus:ring-taller-primary outline-none" required />
                                    <input type="text" value={quickMatricula} onChange={e => setQuickMatricula(e.target.value.toUpperCase())} placeholder="DOMINIO" className="px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600 focus:ring-1 focus:ring-taller-primary outline-none" />
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Descripción del trabajo..." className="md:col-span-2 px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600 focus:ring-1 focus:ring-taller-primary outline-none" rows={2}/>
                            <input type="number" value={kilometraje} onChange={e => setKilometraje(e.target.value)} placeholder="KM Actuales" className="px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600 focus:ring-1 focus:ring-taller-primary outline-none"/>
                        </div>

                        {/* Items Section with Drag & Drop and Categories */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="font-bold text-sm text-taller-gray uppercase tracking-wider">Servicios y Repuestos</h3>
                                <p className="text-[10px] text-gray-400">Mantén presionado <Bars3Icon className="h-3 w-3 inline mb-0.5" /> para reordenar</p>
                            </div>
                            
                            <div 
                                className="space-y-3" 
                                ref={listRef}
                                onTouchMove={handleTouchMove}
                                onTouchEnd={handleTouchEnd}
                            >
                                {partes.length === 0 && (
                                    <div className="text-center py-6 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
                                        <p className="text-xs text-gray-400 font-medium italic">Usa los botones de abajo para añadir ítems</p>
                                    </div>
                                )}
                                {partes.map((p, idx) => {
                                    const isExiting = exitingItemIds.has(p._id);
                                    const isDragging = draggedItemIndex === idx;

                                    if (p.isCategory) {
                                        return (
                                            <div 
                                                key={p._id} 
                                                data-id={p._id}
                                                draggable
                                                onDragStart={() => handleDragStart(idx)}
                                                onDragEnter={() => handleDragEnter(idx)}
                                                onDragEnd={handleDragEnd}
                                                className={`flex items-center gap-2 p-2 bg-gray-200 dark:bg-gray-700 rounded-lg transition-all duration-300 ${isExiting ? 'animate-slide-out-right' : 'animate-entry-expand'} ${isDragging ? 'opacity-70 scale-[1.02] border-2 border-taller-primary shadow-xl z-[100] ring-4 ring-taller-primary/20' : 'shadow-sm'}`}
                                            >
                                                <div 
                                                    className="cursor-grab active:cursor-grabbing p-2 text-gray-400"
                                                    onTouchStart={(e) => handleTouchStart(idx, e)}
                                                >
                                                    <Bars3Icon className="h-6 w-6"/>
                                                </div>
                                                <div className="p-1.5 rounded bg-white/50 dark:bg-gray-600 text-taller-dark dark:text-taller-light"><TagIcon className="h-4 w-4"/></div>
                                                <input 
                                                    type="text" 
                                                    value={p.nombre} 
                                                    onChange={e => handleParteChange(idx, 'nombre', e.target.value)} 
                                                    className="flex-1 bg-transparent focus:outline-none text-sm font-bold placeholder:text-gray-400" 
                                                    placeholder="TÍTULO DE CATEGORÍA..."
                                                />
                                                <button type="button" onClick={() => removeParte(idx)} className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"><TrashIcon className="h-4 w-4"/></button>
                                            </div>
                                        );
                                    }

                                    return (
                                        <div 
                                            key={p._id} 
                                            data-id={p._id}
                                            draggable
                                            onDragStart={() => handleDragStart(idx)}
                                            onDragEnter={() => handleDragEnter(idx)}
                                            onDragEnd={handleDragEnd}
                                            className={`flex flex-col gap-2 p-2 bg-white dark:bg-gray-700/50 border dark:border-gray-600 rounded-lg transition-all duration-300 ${isExiting ? 'animate-slide-out-right' : 'animate-entry-expand'} ${isDragging ? 'opacity-70 scale-[1.02] border-2 border-taller-primary shadow-xl z-[100] ring-4 ring-taller-primary/20' : 'shadow-sm'} ${p.clientPaidDirectly ? 'opacity-60 grayscale-[0.3]' : ''}`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <div 
                                                    className="cursor-grab active:cursor-grabbing p-2 text-gray-300"
                                                    onTouchStart={(e) => handleTouchStart(idx, e)}
                                                >
                                                    <Bars3Icon className="h-6 w-6"/>
                                                </div>
                                                <div className={`p-1.5 rounded ${p.isService ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}>
                                                    {p.isService ? <WrenchScrewdriverIcon className="h-4 w-4"/> : <ArchiveBoxIcon className="h-4 w-4"/>}
                                                </div>
                                                
                                                <div className="flex-1">
                                                    <input 
                                                        type="text" 
                                                        value={p.nombre} 
                                                        onChange={e => handleParteChange(idx, 'nombre', e.target.value)} 
                                                        className={`w-full bg-transparent focus:outline-none text-sm font-medium ${p.clientPaidDirectly ? 'line-through decoration-gray-400' : ''}`} 
                                                        placeholder={p.isService ? "Nombre del servicio..." : "Repuesto / Insumo..."}
                                                    />
                                                </div>
                                                <button type="button" onClick={() => removeParte(idx)} className="p-1 text-red-400 hover:text-red-600 transition-colors"><TrashIcon className="h-4 w-4"/></button>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-3 pl-11 pb-1">
                                                <div className="flex items-center gap-1">
                                                    <span className="text-[10px] text-gray-400 uppercase font-bold">Cant:</span>
                                                    <input 
                                                        type="number" 
                                                        value={p.cantidad} 
                                                        onChange={e => handleParteChange(idx, 'cantidad', e.target.value)} 
                                                        className="w-10 bg-transparent border-b border-gray-200 dark:border-gray-600 text-center text-sm focus:border-taller-primary outline-none no-spinner" 
                                                    />
                                                </div>
                                                <div className="flex-1 flex items-center gap-1">
                                                    <span className="text-[10px] text-gray-400 uppercase font-bold">Precio:</span>
                                                    <input 
                                                        type="text" 
                                                        value={p.precioUnitario} 
                                                        onChange={e => handleParteChange(idx, 'precioUnitario', formatCurrency(e.target.value))} 
                                                        className={`w-full bg-transparent border-b border-gray-200 dark:border-gray-600 text-right text-sm font-bold focus:border-taller-primary outline-none ${p.clientPaidDirectly ? 'line-through opacity-50' : ''}`} 
                                                        placeholder="$ 0,00"
                                                    />
                                                </div>
                                                
                                                {/* Action Buttons: Maintenance Tag & Client Paid */}
                                                <div className="flex items-center gap-2 min-w-[140px]">
                                                    <div className="flex items-center gap-1 border-r pr-2 dark:border-gray-600">
                                                        <BeakerIcon className={`h-3 w-3 ${p.maintenanceType ? 'text-taller-primary' : 'text-gray-300'}`} />
                                                        <select
                                                            value={p.maintenanceType || ''}
                                                            onChange={(e) => handleParteChange(idx, 'maintenanceType', e.target.value)}
                                                            className={`text-[10px] bg-transparent border-none focus:ring-0 cursor-pointer font-bold uppercase transition-colors ${p.maintenanceType ? 'text-taller-primary' : 'text-gray-400 italic'}`}
                                                        >
                                                            <option value="">Sin Tag</option>
                                                            {ALL_MAINTENANCE_OPTS.map(opt => (
                                                                <option key={opt.key} value={opt.key}>{opt.label}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    
                                                    <button 
                                                        type="button"
                                                        onClick={() => handleParteChange(idx, 'clientPaidDirectly', !p.clientPaidDirectly)}
                                                        className={`p-1.5 rounded-md transition-all flex items-center gap-1 ${p.clientPaidDirectly ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30' : 'bg-gray-50 text-gray-400 dark:bg-gray-800'}`}
                                                        title={p.clientPaidDirectly ? "Pagado por cliente (activado)" : "Marcar como pagado por el cliente"}
                                                    >
                                                        <ShoppingBagIcon className="h-3.5 w-3.5" />
                                                        <span className="text-[9px] font-bold uppercase hidden sm:inline">Traído</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="flex flex-wrap gap-2 justify-center pt-2">
                                <button type="button" onClick={addParte} className="flex-1 min-w-[100px] flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-full hover:bg-gray-50 dark:hover:bg-gray-600 shadow-sm transition-all active:scale-95">
                                    <ArchiveBoxIcon className="h-4 w-4 text-green-500" /> + Repuesto
                                </button>
                                <button type="button" onClick={addService} className="flex-1 min-w-[100px] flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-full hover:bg-blue-100 shadow-sm transition-all active:scale-95">
                                    <WrenchScrewdriverIcon className="h-4 w-4" /> + Servicio
                                </button>
                                <button type="button" onClick={addCategory} className="flex-1 min-w-[100px] flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-full hover:bg-gray-200 shadow-sm transition-all active:scale-95">
                                    <TagIcon className="h-4 w-4" /> + Categoría
                                </button>
                            </div>
                        </div>

                        {error && <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-800"><p className="text-red-600 dark:text-red-400 text-xs font-bold text-center">{error}</p></div>}
                    </form>
                </div>

                <div className="p-4 border-t flex flex-wrap gap-3 bg-white dark:bg-gray-800 safe-area-bottom">
                    {isEditMode && (
                        <div className="flex-[1] min-w-[120px]">
                            {confirmingDelete ? (
                                <div className="flex gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <button 
                                        type="button" 
                                        onClick={handleDelete} 
                                        disabled={isDeleting}
                                        className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs shadow-lg transition-all"
                                    >
                                        {isDeleting ? '...' : 'Confirmar'}
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={() => setConfirmingDelete(false)}
                                        className="flex-1 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-bold text-xs transition-all"
                                    >
                                        No
                                    </button>
                                </div>
                            ) : (
                                <button 
                                    type="button" 
                                    onClick={() => setConfirmingDelete(true)}
                                    className="w-full py-3 border border-red-200 dark:border-red-900/30 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                                >
                                    <TrashIcon className="h-4 w-4" /> Eliminar
                                </button>
                            )}
                        </div>
                    )}
                    <button type="button" onClick={handleClose} className="flex-1 min-w-[100px] py-3 border border-gray-300 dark:border-gray-600 rounded-xl font-bold text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all">Cancelar</button>
                    <button 
                        type="button" 
                        onClick={handleSubmit} 
                        disabled={isSubmitting} 
                        className="flex-[2] min-w-[150px] py-3 bg-taller-primary hover:bg-taller-secondary text-white rounded-xl font-bold shadow-lg shadow-taller-primary/20 transition-all active:scale-95 disabled:opacity-50"
                    >
                        {isSubmitting ? 'Guardando...' : (isEditMode ? 'Guardar Cambios' : 'Crear Presupuesto')}
                    </button>
                </div>
            </div>
            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #475569; }
                .no-spinner::-webkit-inner-spin-button, .no-spinner::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
                
                /* Estilos para que el arrastre táctil sea evidente */
                [draggable="true"] {
                    touch-action: pan-y;
                }
            `}</style>
        </div>,
        document.body
    );
};

export default CrearTrabajoModal;
