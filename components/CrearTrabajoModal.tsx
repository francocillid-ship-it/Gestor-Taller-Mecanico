
import React, { useState, useEffect, useMemo, useRef, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../supabaseClient';
import type { Cliente, Parte, Trabajo } from '../types';
import { JobStatus } from '../types';
import { XMarkIcon, TrashIcon, WrenchScrewdriverIcon, TagIcon, ArchiveBoxIcon, Bars3Icon, ShoppingBagIcon, BoltIcon, UsersIcon, CheckIcon, CurrencyDollarIcon, CalendarDaysIcon, PencilIcon, ArrowPathIcon, MapPinIcon } from '@heroicons/react/24/solid';
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

// Estado extendido para manejar pagos en la UI con ID temporal
type PaymentState = {
    _id: string;
    monto: string; // String para el input formateado
    fecha: string; // ISO String
    paymentType: 'items' | 'labor' | undefined;
};

const AutoExpandingInput: React.FC<{
    value: string;
    onChange: (val: string) => void;
    placeholder: string;
    isCategory?: boolean;
}> = ({ value, onChange, placeholder, isCategory }) => {
    const [isFocused, setIsFocused] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const adjustHeight = () => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = `${textarea.scrollHeight}px`;
        }
    };

    useEffect(() => {
        if (isFocused) adjustHeight();
    }, [value, isFocused]);

    return (
        <textarea
            ref={textareaRef}
            rows={1}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={placeholder}
            className={`w-full bg-transparent text-sm font-medium focus:outline-none resize-none overflow-hidden transition-all duration-200 block text-center ${
                isCategory ? 'font-extrabold uppercase text-taller-dark dark:text-taller-light placeholder-gray-400' : 'text-taller-dark dark:text-taller-light'
            } ${!isFocused ? 'whitespace-nowrap truncate max-h-[1.5rem]' : ''}`}
            style={{ 
                minHeight: '1.5rem',
                lineHeight: '1.5rem'
            }}
        />
    );
};

// Componente visual para el ítem arrastrado (Clon)
const DraggedItemClone = React.forwardRef<HTMLDivElement, { 
    parte: ParteState; 
    style: React.CSSProperties;
}>(({ parte, style }, ref) => (
    <div 
        ref={ref}
        style={{
            ...style, 
            position: 'fixed', 
            zIndex: 9999,
            pointerEvents: 'none',
            willChange: 'transform',
            top: 0,
            left: 0
        }}
        className="flex items-center gap-2 p-2 bg-white dark:bg-gray-700 border dark:border-gray-600 rounded-lg shadow-2xl opacity-90 ring-2 ring-taller-primary cursor-grabbing"
    >
        <div className="p-1 mt-0 text-gray-400">
            <Bars3Icon className="h-6 w-6"/>
        </div>
        <div className="flex-1 flex flex-col min-w-0">
            <div className={`flex items-center gap-2 w-full justify-center`}>
                <div className="flex-shrink-0">
                    {parte.isCategory ? (
                        <TagIcon className="h-4 w-4 text-purple-500" />
                    ) : parte.isService ? (
                        <WrenchScrewdriverIcon className="h-4 w-4 text-orange-500" />
                    ) : (
                        <ArchiveBoxIcon className="h-4 w-4 text-blue-500" />
                    )}
                </div>
                <div className={`text-sm font-medium truncate ${parte.isCategory ? 'font-extrabold uppercase text-taller-dark dark:text-taller-light' : 'text-taller-dark'}`}>
                    {parte.nombre || (parte.isCategory ? 'CATEGORÍA' : 'Nombre ítem...')}
                </div>
            </div>
        </div>
    </div>
));
DraggedItemClone.displayName = 'DraggedItemClone';

const CrearTrabajoModal: React.FC<CrearTrabajoModalProps> = ({ onClose, onSuccess, onDataRefresh, clientes, trabajoToEdit, initialClientId }) => {
    const [creationMode, setCreationMode] = useState<'existing' | 'quick'>(trabajoToEdit?.isQuickBudget ? 'quick' : 'existing');
    const [quickNombre, setQuickNombre] = useState('');
    const [quickApellido, setQuickApellido] = useState('');
    const [quickMarca, setQuickMarca] = useState('');
    const [quickModelo, setQuickModelo] = useState('');
    const [quickMatricula, setQuickMatricula] = useState('');
    const [selectedClienteId, setSelectedClienteId] = useState('');
    const [selectedVehiculoId, setSelectedVehiculoId] = useState('');
    const [descripcion, setDescripcion] = useState('');
    const [kilometraje, setKilometraje] = useState(''); 
    const [partes, setPartes] = useState<ParteState[]>([]);
    const [status, setStatus] = useState<JobStatus>(JobStatus.Presupuesto);
    
    // Payment State
    const [pagosList, setPagosList] = useState<PaymentState[]>([]);
    const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
    const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [isVisible, setIsVisible] = useState(false);
    const [exitingItemIds, setExitingItemIds] = useState<Set<string>>(new Set());
    
    // Estados para borrar
    const [isDeleting, setIsDeleting] = useState(false);
    const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
    
    // --- ROBUST DRAG AND DROP STATE & REFS ---
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [dragDimensions, setDragDimensions] = useState({ width: 0, height: 0 });
    
    const cloneRef = useRef<HTMLDivElement>(null);
    const descriptionRef = useRef<HTMLTextAreaElement>(null);
    const dragData = useRef({
        pointerId: -1,
        offsetX: 0,
        offsetY: 0,
        lastX: 0,
        lastY: 0,
        lastUpdate: 0
    });
    
    const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
    const partesRef = useRef(partes);
    const draggedIndexRef = useRef<number | null>(null);

    // Mantener partesRef sincronizado para acceso instantáneo en event listeners
    useEffect(() => {
        partesRef.current = partes;
    }, [partes]);

    const isEditMode = Boolean(trabajoToEdit);

    const selectedClientVehiculos = useMemo(() => {
        const client = clientes.find(c => c.id === selectedClienteId);
        return client?.vehiculos || [];
    }, [clientes, selectedClienteId]);

    const formatCurrency = (value: string | number): string => {
        const strVal = String(value);
        const digits = strVal.replace(/\D/g, '');
        if (digits === '') return '';
        const numberValue = parseInt(digits, 10);
        return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(numberValue / 100);
    };

    const parseCurrency = (value: string): number => {
        const digits = value.replace(/\D/g, '');
        if (digits === '') return 0;
        return parseInt(digits, 10) / 100;
    };

    const generateId = () => Math.random().toString(36).substr(2, 9);

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
            setPartes(initialPartes.map(p => ({
                ...p,
                _id: generateId(),
                precioUnitario: new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(p.precioUnitario),
            })));
            
            const initialPagos = trabajoToEdit.partes.filter(p => p.nombre === '__PAGO_REGISTRADO__');
            setPagosList(initialPagos.map(p => ({
                _id: generateId(),
                monto: new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(p.precioUnitario),
                fecha: p.fecha || new Date().toISOString(),
                paymentType: p.paymentType
            })));

            setStatus(trabajoToEdit.status);
        } else if (initialClientId) {
            setSelectedClienteId(initialClientId);
        }
        requestAnimationFrame(() => setIsVisible(true));
    }, [trabajoToEdit, initialClientId]);

    // Auto-resize description textarea
    useEffect(() => {
        if (descriptionRef.current) {
            descriptionRef.current.style.height = 'auto';
            descriptionRef.current.style.height = `${descriptionRef.current.scrollHeight}px`;
        }
    }, [descripcion, isVisible]);

    const handleClose = () => {
        setIsVisible(false);
        setTimeout(onClose, 300);
    };

    const handleParteChange = (index: number, field: keyof ParteState, value: any) => {
        const newPartes = [...partes];
        (newPartes[index] as any)[field] = value;
        setPartes(newPartes);
    };

    const removeParte = (index: number) => {
        const id = partes[index]._id;
        setExitingItemIds(prev => new Set(prev).add(id));
        setTimeout(() => {
            setPartes(prev => prev.filter((_, i) => i !== index));
            setExitingItemIds(prev => {
                const n = new Set(prev);
                n.delete(id);
                return n;
            });
        }, 300);
    };

    // --- PAYMENT LOGIC ---
    const handleUpdatePayment = (id: string, field: keyof PaymentState, value: any) => {
        setPagosList(prev => prev.map(p => {
            if (p._id !== id) return p;
            if (field === 'monto') {
                return { ...p, [field]: formatCurrency(value) };
            }
            return { ...p, [field]: value };
        }));
    };

    const handleAskDeletePayment = (id: string) => {
        setDeletingPaymentId(id);
        setEditingPaymentId(null);
    };

    const confirmDeletePayment = (id: string) => {
        setPagosList(prev => prev.filter(p => p._id !== id));
        setDeletingPaymentId(null);
    };

    const cancelDeletePayment = () => {
        setDeletingPaymentId(null);
    };

    // --- DRAG AND DROP LOGIC OPTIMIZED ---

    const handleWindowMove = useCallback((e: PointerEvent) => {
        if (draggedIndexRef.current === null) return;
        if (e.pointerId !== dragData.current.pointerId) return;
        e.preventDefault();

        // Actualizar coordenadas actuales
        dragData.current.lastX = e.clientX;
        dragData.current.lastY = e.clientY;

        // 1. Mover Clon Visualmente (Direct DOM Update)
        if (cloneRef.current) {
            const x = e.clientX - dragData.current.offsetX;
            const y = e.clientY - dragData.current.offsetY;
            cloneRef.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        }

        // 2. Lógica de Intercambio (Con Refs para evitar stale closures)
        const now = Date.now();
        if (now - dragData.current.lastUpdate < 50) return; // Throttle 50ms

        const currentIdx = draggedIndexRef.current;
        const currentY = e.clientY;
        
        const prevIdx = currentIdx - 1;
        const nextIdx = currentIdx + 1;
        let targetIdx = -1;

        // Chequear Arriba
        if (prevIdx >= 0) {
            const prevEl = itemRefs.current[prevIdx];
            if (prevEl) {
                const rect = prevEl.getBoundingClientRect();
                const mid = rect.top + (rect.height / 2);
                if (currentY < mid) targetIdx = prevIdx;
            }
        }

        // Chequear Abajo (si no se movió arriba)
        if (targetIdx === -1 && nextIdx < partesRef.current.length) {
            const nextEl = itemRefs.current[nextIdx];
            if (nextEl) {
                const rect = nextEl.getBoundingClientRect();
                const mid = rect.top + (rect.height / 2);
                if (currentY > mid) targetIdx = nextIdx;
            }
        }

        if (targetIdx !== -1) {
            dragData.current.lastUpdate = now;
            
            const newPartes = [...partesRef.current];
            const [item] = newPartes.splice(currentIdx, 1);
            newPartes.splice(targetIdx, 0, item);
            
            // Actualizar Refs inmediatamente para el próximo evento
            partesRef.current = newPartes;
            draggedIndexRef.current = targetIdx;
            
            // Actualizar estado para renderizar
            setPartes(newPartes);
            setDraggedIndex(targetIdx);
        }
    }, []);

    const handleWindowUp = useCallback((e: PointerEvent) => {
        if (draggedIndexRef.current !== null && e.pointerId === dragData.current.pointerId) {
            draggedIndexRef.current = null;
            setDraggedIndex(null);
            document.body.classList.remove('grabbing-active');
            window.removeEventListener('pointermove', handleWindowMove);
            window.removeEventListener('pointerup', handleWindowUp);
            window.removeEventListener('pointercancel', handleWindowUp);
        }
    }, [handleWindowMove]);

    const handleDragStart = (e: React.PointerEvent, index: number) => {
        e.preventDefault();
        const item = itemRefs.current[index];
        if (!item) return;

        const rect = item.getBoundingClientRect();
        
        dragData.current = {
            pointerId: e.pointerId,
            offsetX: e.clientX - rect.left,
            offsetY: e.clientY - rect.top,
            lastX: e.clientX,
            lastY: e.clientY,
            lastUpdate: Date.now()
        };

        setDragDimensions({ width: rect.width, height: rect.height });
        
        draggedIndexRef.current = index;
        setDraggedIndex(index);
        
        document.body.classList.add('grabbing-active');
        
        // Listeners Globales (Window) para no perder tracking
        window.addEventListener('pointermove', handleWindowMove, { passive: false });
        window.addEventListener('pointerup', handleWindowUp);
        window.addEventListener('pointercancel', handleWindowUp);
    };

    // CORRECCIÓN CRÍTICA: Restaurar posición del clon tras re-renderizado
    // Esto evita que el clon "parpadee" a (0,0) cuando React actualiza el DOM
    useLayoutEffect(() => {
        if (draggedIndex !== null && cloneRef.current) {
            const x = dragData.current.lastX - dragData.current.offsetX;
            const y = dragData.current.lastY - dragData.current.offsetY;
            cloneRef.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        }
    });

    // --- Manejador para lista automática (bullets) ---
    const handleDescriptionKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const { selectionStart, selectionEnd, value } = e.currentTarget;
            
            const insertion = '\n• ';
            const newValue = value.substring(0, selectionStart) + insertion + value.substring(selectionEnd);
            
            setDescripcion(newValue);
            
            // Mover cursor después de la inserción y ajustar altura
            setTimeout(() => {
                if (descriptionRef.current) {
                    const newCursorPos = selectionStart + insertion.length;
                    descriptionRef.current.selectionStart = newCursorPos;
                    descriptionRef.current.selectionEnd = newCursorPos;
                    // Forzar re-cálculo de altura
                    descriptionRef.current.style.height = 'auto';
                    descriptionRef.current.style.height = `${descriptionRef.current.scrollHeight}px`;
                }
            }, 0);
        }
    };

    const handleDescriptionFocus = () => {
        if (!descripcion) {
            setDescripcion("• ");
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (creationMode === 'existing' && (!selectedClienteId || !selectedVehiculoId)) {
            setError('Seleccione cliente y vehículo.');
            return;
        }
        setIsSubmitting(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("No auth");
            const cleanPartes = partes.filter(p => p.nombre.trim() !== '').map(p => ({
                nombre: p.nombre,
                cantidad: p.isCategory ? 0 : Number(p.cantidad || 1),
                precioUnitario: p.isCategory ? 0 : parseCurrency(p.precioUnitario),
                isCategory: !!p.isCategory,
                isService: !!p.isService,
                maintenanceType: p.maintenanceType,
                clientPaidDirectly: !!p.clientPaidDirectly
            }));
            
            const cleanPagos = pagosList.map(p => ({
                nombre: '__PAGO_REGISTRADO__',
                cantidad: 1,
                precioUnitario: parseCurrency(p.monto),
                fecha: p.fecha,
                paymentType: p.paymentType
            }));

            const jobData = {
                cliente_id: selectedClienteId || null,
                vehiculo_id: selectedVehiculoId || null,
                taller_id: user.id,
                descripcion,
                status,
                partes: [...cleanPartes, ...cleanPagos],
                kilometraje: kilometraje ? parseInt(kilometraje, 10) : null,
                costo_estimado: cleanPartes.reduce((s, p) => s + (p.cantidad * p.precioUnitario), 0),
                is_quick_budget: creationMode === 'quick' && status === JobStatus.Presupuesto,
                quick_budget_data: creationMode === 'quick' ? { 
                    nombre: quickNombre, 
                    apellido: quickApellido, 
                    marca: quickMarca, 
                    modelo: quickModelo, 
                    matricula: quickMatricula 
                } : null
            };
            if (isEditMode) await supabase.from('trabajos').update(jobData).eq('id', trabajoToEdit!.id);
            else await supabase.from('trabajos').insert(jobData);
            onSuccess();
        } catch (err: any) {
            setError(err.message);
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!trabajoToEdit) return;
        setIsDeleting(true);
        try {
            const { error } = await supabase.from('trabajos').delete().eq('id', trabajoToEdit.id);
            if (error) throw error;
            onSuccess(); // Close modal and refresh data
        } catch (err: any) {
            setError('Error al eliminar: ' + err.message);
            setIsDeleting(false);
            setIsConfirmingDelete(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[100] flex justify-center items-end sm:items-center">
            <div className={`fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`} onClick={handleClose}/>
            <div className={`bg-white dark:bg-gray-800 w-full h-[100dvh] sm:h-auto sm:max-h-[90vh] sm:max-w-2xl sm:rounded-t-xl flex flex-col overflow-hidden relative z-10 transform transition-all duration-300 ease-out ${isVisible ? 'translate-y-0' : 'translate-y-full'}`}>
                <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50 flex-shrink-0">
                    <h2 className="font-bold">{isEditMode ? 'Editar' : 'Nuevo'} Trabajo</h2>
                    <button onClick={handleClose} className="p-1"><XMarkIcon className="h-6 w-6"/></button>
                </div>
                
                {!isEditMode && (
                    <div className="bg-gray-100 dark:bg-gray-900 p-1 flex-shrink-0">
                        <div className="flex bg-white dark:bg-gray-800 rounded-lg p-1 gap-1">
                            <button type="button" onClick={() => setCreationMode('existing')} className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold rounded-md transition-all ${creationMode === 'existing' ? 'bg-taller-primary text-white shadow-md' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'}`}><UsersIcon className="h-4 w-4" /> Cliente</button>
                            <button type="button" onClick={() => setCreationMode('quick')} className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold rounded-md transition-all ${creationMode === 'quick' ? 'bg-taller-primary text-white shadow-md' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'}`}><BoltIcon className="h-4 w-4" /> Rápido</button>
                        </div>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto p-4 space-y-4 overscroll-none touch-auto">
                    <form onSubmit={handleSubmit} className="space-y-4 pb-12">
                        {creationMode === 'existing' ? (
                            <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                    <select value={selectedClienteId} onChange={e => setSelectedClienteId(e.target.value)} className="p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm" required>
                                        <option value="">Cliente...</option>
                                        {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre} {c.apellido}</option>)}
                                    </select>
                                    <select value={selectedVehiculoId} onChange={e => setSelectedVehiculoId(e.target.value)} className="p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm" required disabled={!selectedClienteId}>
                                        <option value="">Vehículo...</option>
                                        {selectedClientVehiculos.map(v => <option key={v.id} value={v.id}>{v.marca} {v.modelo}</option>)}
                                    </select>
                                </div>
                                {(status === JobStatus.EnProceso || status === JobStatus.Finalizado) && (
                                    <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                        <label className="block text-[10px] font-bold text-taller-gray dark:text-gray-400 uppercase mb-1 pl-1">Kilometraje Actual (Opcional)</label>
                                        <div className="relative">
                                            <MapPinIcon className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                                            <input 
                                                type="number" 
                                                placeholder="Ej: 125000" 
                                                value={kilometraje} 
                                                onChange={e => setKilometraje(e.target.value)} 
                                                className="w-full pl-9 pr-12 p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm focus:ring-1 focus:ring-taller-primary outline-none"
                                            />
                                            <span className="absolute right-3 top-2.5 text-[10px] font-bold text-gray-400">KM</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                    <input type="text" placeholder="Nombre" value={quickNombre} onChange={e => setQuickNombre(e.target.value)} className="p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm" required/>
                                    <input type="text" placeholder="Apellido (Opcional)" value={quickApellido} onChange={e => setQuickApellido(e.target.value)} className="p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"/>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <input type="text" placeholder="Marca" value={quickMarca} onChange={e => setQuickMarca(e.target.value)} className="p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm" required/>
                                    <input type="text" placeholder="Modelo" value={quickModelo} onChange={e => setQuickModelo(e.target.value)} className="p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm" required/>
                                </div>
                                <input type="text" placeholder="Matrícula" value={quickMatricula} onChange={e => setQuickMatricula(e.target.value)} className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"/>
                            </div>
                        )}
                        
                        <textarea
                            ref={descriptionRef}
                            value={descripcion}
                            onChange={e => setDescripcion(e.target.value)}
                            onKeyDown={handleDescriptionKeyDown}
                            onFocus={handleDescriptionFocus}
                            placeholder="Descripción del trabajo..."
                            className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm resize-none overflow-hidden"
                            rows={2}
                        />
                        
                        <div className={`space-y-3 relative ${draggedIndex !== null ? 'select-none' : ''}`}>
                            {partes.map((p, idx) => {
                                const isBeingDragged = draggedIndex === idx;
                                
                                return (
                                    <React.Fragment key={p._id}>
                                        <div 
                                            ref={el => itemRefs.current[idx] = el}
                                            className={`flex items-center gap-2 p-2 rounded-lg shadow-sm bg-white dark:bg-gray-700 border dark:border-gray-600 transition-opacity duration-200 ${
                                                exitingItemIds.has(p._id) ? 'opacity-0 scale-95' : ''
                                            } ${
                                                isBeingDragged 
                                                ? 'opacity-0' // Ocultamos el elemento real, se muestra el clon
                                                : 'opacity-100'
                                            }`}
                                        >
                                            {/* Handle de Arrastre */}
                                            <div 
                                                className="p-1 cursor-grab active:cursor-grabbing touch-none select-none text-gray-400"
                                                onPointerDown={(e) => handleDragStart(e, idx)}
                                            >
                                                <Bars3Icon className="h-6 w-6"/>
                                            </div>

                                            {/* Contenido Normal */}
                                            <div className="flex-1 flex flex-col min-w-0">
                                                <div className={`flex items-center gap-2 w-full justify-center`}>
                                                    <div className="flex-shrink-0">
                                                        {p.isCategory ? (
                                                            <TagIcon className="h-4 w-4 text-purple-500" />
                                                        ) : p.isService ? (
                                                            <WrenchScrewdriverIcon className="h-4 w-4 text-orange-500" />
                                                        ) : (
                                                            <ArchiveBoxIcon className="h-4 w-4 text-blue-500" />
                                                        )}
                                                    </div>
                                                    
                                                    <AutoExpandingInput 
                                                        value={p.nombre}
                                                        onChange={val => handleParteChange(idx, 'nombre', val)}
                                                        placeholder={p.isCategory ? 'CATEGORÍA' : 'Nombre ítem...'}
                                                        isCategory={p.isCategory}
                                                    />
                                                </div>
                                                {!p.isCategory && (
                                                    <div className="flex flex-col gap-2 mt-2">
                                                        <div className="flex gap-2 ml-6">
                                                            <input type="text" value={p.precioUnitario} onChange={e => handleParteChange(idx, 'precioUnitario', formatCurrency(e.target.value))} className="w-24 text-xs border-b dark:border-gray-500 bg-transparent py-1" placeholder="$ 0,00"/>
                                                            <input type="number" value={p.cantidad} onChange={e => handleParteChange(idx, 'cantidad', e.target.value)} className="w-12 text-xs border-b dark:border-gray-500 bg-transparent py-1" placeholder="1"/>
                                                        </div>
                                                        <div className="flex items-center gap-2 ml-6">
                                                            <select 
                                                                value={p.maintenanceType || ''} 
                                                                onChange={e => handleParteChange(idx, 'maintenanceType', e.target.value)}
                                                                className="flex-1 text-[10px] bg-gray-50 dark:bg-gray-600 border dark:border-gray-500 rounded px-1 py-0.5 focus:outline-none"
                                                            >
                                                                <option value="">Sin Etiqueta</option>
                                                                {ALL_MAINTENANCE_OPTS.map(opt => (
                                                                    <option key={opt.key} value={opt.key}>{opt.label}</option>
                                                                ))}
                                                            </select>
                                                            <button 
                                                                type="button" 
                                                                onClick={() => handleParteChange(idx, 'clientPaidDirectly', !p.clientPaidDirectly)} 
                                                                className={`p-1 rounded transition-colors ${p.clientPaidDirectly ? 'bg-purple-100 text-purple-600 ring-1 ring-purple-300' : 'bg-gray-100 text-gray-400 dark:bg-gray-600'}`}
                                                                title="Pagado por el cliente"
                                                            >
                                                                <ShoppingBagIcon className="h-4 w-4" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            <button type="button" onClick={() => removeParte(idx)} className="p-1 flex-shrink-0 text-red-500"><TrashIcon className="h-5 w-5"/></button>
                                        </div>
                                    </React.Fragment>
                                );
                            })}
                            
                            {/* Action Buttons */}
                            <div className="grid grid-cols-3 gap-2 pt-2">
                                <button 
                                    type="button" 
                                    onClick={() => setPartes([...partes, { _id: generateId(), nombre: '', cantidad: 1, precioUnitario: '', isService: false }])} 
                                    className="flex items-center justify-center gap-2 py-2 rounded-lg transition-all active:scale-95 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800"
                                >
                                    <ArchiveBoxIcon className="h-4 w-4 shrink-0"/>
                                    <span className="text-[10px] font-bold uppercase tracking-tight">Repuesto</span>
                                </button>
                                
                                <button 
                                    type="button" 
                                    onClick={() => setPartes([...partes, { _id: generateId(), nombre: '', cantidad: 1, precioUnitario: '', isService: true }])} 
                                    className="flex items-center justify-center gap-2 py-2 rounded-lg transition-all active:scale-95 bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border border-orange-100 dark:border-orange-800"
                                >
                                    <WrenchScrewdriverIcon className="h-4 w-4 shrink-0"/>
                                    <span className="text-[10px] font-bold uppercase tracking-tight">Servicio</span>
                                </button>
                                
                                <button 
                                    type="button" 
                                    onClick={() => setPartes([...partes, { _id: generateId(), nombre: '', cantidad: 0, precioUnitario: '', isCategory: true }])} 
                                    className="flex items-center justify-center gap-2 py-2 rounded-lg transition-all active:scale-95 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-100 dark:border-purple-800"
                                >
                                    <TagIcon className="h-4 w-4 shrink-0"/>
                                    <span className="text-[10px] font-bold uppercase tracking-tight">Categoría</span>
                                </button>
                            </div>
                        </div>

                        {/* --- LISTA DE PAGOS REGISTRADOS --- */}
                        {pagosList.length > 0 && (
                            <div className="mt-6 pt-4 border-t dark:border-gray-700 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <h3 className="text-xs font-bold uppercase text-taller-gray mb-3 flex items-center gap-2">
                                    <CurrencyDollarIcon className="h-4 w-4 text-green-500" />
                                    Pagos Registrados
                                </h3>
                                <div className="space-y-3">
                                    {pagosList.map((pago) => {
                                        const isEditing = editingPaymentId === pago._id;
                                        const isDeletingThis = deletingPaymentId === pago._id;
                                        
                                        return (
                                            <div 
                                                key={pago._id} 
                                                className={`relative rounded-lg transition-all duration-300 overflow-hidden ${isEditing ? 'bg-white dark:bg-gray-700 shadow-md ring-2 ring-taller-primary p-3' : (isDeletingThis ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-2' : 'bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/30 p-3 hover:shadow-sm')}`}
                                            >
                                                {isDeletingThis ? (
                                                    <div className="flex items-center justify-between animate-in fade-in zoom-in duration-200">
                                                        <span className="text-xs font-bold text-red-600 dark:text-red-400 pl-1">¿Borrar este pago?</span>
                                                        <div className="flex gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => confirmDeletePayment(pago._id)}
                                                                className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded shadow-sm hover:bg-red-700 transition-colors"
                                                            >
                                                                <CheckIcon className="h-3 w-3" /> Sí
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={cancelDeletePayment}
                                                                className="flex items-center gap-1 px-3 py-1.5 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 text-xs font-bold rounded shadow-sm hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                                                            >
                                                                <XMarkIcon className="h-3 w-3" /> No
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : isEditing ? (
                                                    <div className="space-y-2 animate-in fade-in zoom-in duration-200">
                                                        <div className="flex justify-between items-center mb-2">
                                                            <span className="text-xs font-bold text-taller-primary uppercase">Editar Pago</span>
                                                            <button type="button" onClick={() => setEditingPaymentId(null)} className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300">
                                                                <XMarkIcon className="h-4 w-4" />
                                                            </button>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <div>
                                                                <label className="block text-[10px] text-gray-500 uppercase font-bold mb-1">Monto</label>
                                                                <input 
                                                                    type="text" 
                                                                    value={pago.monto} 
                                                                    onChange={(e) => handleUpdatePayment(pago._id, 'monto', e.target.value)} 
                                                                    className="w-full text-sm font-bold text-taller-dark dark:text-white bg-transparent border-b border-gray-300 dark:border-gray-600 focus:border-taller-primary focus:outline-none py-1"
                                                                    autoFocus
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-[10px] text-gray-500 uppercase font-bold mb-1">Fecha</label>
                                                                <input 
                                                                    type="date" 
                                                                    value={pago.fecha.split('T')[0]} 
                                                                    onChange={(e) => handleUpdatePayment(pago._id, 'fecha', new Date(e.target.value).toISOString())}
                                                                    className="w-full text-xs bg-transparent border-b border-gray-300 dark:border-gray-600 focus:border-taller-primary focus:outline-none py-1.5 dark:text-white"
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="pt-2">
                                                            <label className="block text-[10px] text-gray-500 uppercase font-bold mb-1">Tipo</label>
                                                            <div className="flex gap-1">
                                                                {[{id: 'items', label: 'Repuestos'}, {id: 'labor', label: 'Mano Obra'}, {id: undefined, label: 'General'}].map(type => (
                                                                    <button
                                                                        key={String(type.id)}
                                                                        type="button"
                                                                        onClick={() => handleUpdatePayment(pago._id, 'paymentType', type.id)}
                                                                        className={`flex-1 py-1 text-[10px] font-bold rounded border transition-colors ${pago.paymentType === type.id ? 'bg-taller-primary text-white border-taller-primary' : 'bg-gray-50 dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-600'}`}
                                                                    >
                                                                        {type.label}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                        <button 
                                                            type="button" 
                                                            onClick={() => setEditingPaymentId(null)} 
                                                            className="w-full mt-2 py-1.5 bg-taller-primary text-white text-xs font-bold rounded flex items-center justify-center gap-1 hover:bg-taller-secondary"
                                                        >
                                                            <CheckIcon className="h-3 w-3" /> Guardar Cambios
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="flex justify-between items-center group">
                                                        <div>
                                                            <p className="text-lg font-bold text-green-700 dark:text-green-400 tracking-tight">{pago.monto}</p>
                                                            <div className="flex items-center gap-2 mt-0.5 text-xs text-green-800/70 dark:text-green-300/70">
                                                                <span className="flex items-center gap-1"><CalendarDaysIcon className="h-3 w-3"/> {new Date(pago.fecha).toLocaleDateString('es-ES')}</span>
                                                                <span>•</span>
                                                                <span className="font-medium uppercase text-[10px] border border-green-200 dark:border-green-800 px-1 rounded bg-white/50 dark:bg-black/20">
                                                                    {pago.paymentType === 'items' ? 'Repuestos' : pago.paymentType === 'labor' ? 'Mano de Obra' : 'General'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                                            <button 
                                                                type="button" 
                                                                onClick={() => { setEditingPaymentId(pago._id); setDeletingPaymentId(null); }} 
                                                                className="p-1.5 bg-white dark:bg-gray-800 text-gray-500 hover:text-taller-primary rounded shadow-sm border border-gray-100 dark:border-gray-600 transition-colors"
                                                            >
                                                                <PencilIcon className="h-4 w-4" />
                                                            </button>
                                                            <button 
                                                                type="button" 
                                                                onClick={() => handleAskDeletePayment(pago._id)} 
                                                                className="p-1.5 bg-white dark:bg-gray-800 text-gray-500 hover:text-red-500 rounded shadow-sm border border-gray-100 dark:border-gray-600 transition-colors"
                                                            >
                                                                <TrashIcon className="h-4 w-4" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {error && <p className="text-red-500 text-xs font-bold">{error}</p>}
                    </form>
                </div>
                <div className="p-4 border-t dark:border-gray-700 bg-white dark:bg-gray-800 flex gap-2 flex-shrink-0">
                     {isEditMode && (
                        <div className="flex-1 flex gap-1">
                            {!isConfirmingDelete ? (
                                <button 
                                    type="button"
                                    onClick={() => setIsConfirmingDelete(true)}
                                    className="w-full py-3 bg-red-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-red-700 transition-colors shadow-sm"
                                >
                                    <TrashIcon className="h-5 w-5"/> <span className="hidden sm:inline">Eliminar</span> <span className="sm:hidden">Borrar</span>
                                </button>
                            ) : (
                                <>
                                    <button 
                                        type="button"
                                        onClick={handleDelete}
                                        disabled={isDeleting}
                                        className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1 hover:bg-red-700 transition-colors shadow-inner"
                                    >
                                        {isDeleting ? '...' : <><CheckIcon className="h-4 w-4"/> Sí</>}
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => setIsConfirmingDelete(false)}
                                        disabled={isDeleting}
                                        className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-xl font-bold text-xs flex items-center justify-center hover:bg-gray-300 transition-colors"
                                    >
                                        No
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                    <button onClick={handleClose} className="flex-1 py-3 border rounded-xl font-bold text-gray-500 hover:bg-gray-50 transition-colors">Cancelar</button>
                    <button onClick={handleSubmit} disabled={isSubmitting} className="flex-[2] py-3 bg-taller-primary text-white rounded-xl font-bold shadow-lg disabled:opacity-50 transition-all active:scale-[0.98]">{isSubmitting ? 'Guardando...' : 'Guardar'}</button>
                </div>
            </div>
            
            {/* PORTAL PARA EL ÍTEM ARRASTRADO (SOLUCIÓN FIJA AL CURSOR) */}
            {draggedIndex !== null && createPortal(
                <DraggedItemClone 
                    ref={cloneRef}
                    parte={partes[draggedIndex]} 
                    style={{ 
                        width: dragDimensions.width,
                        height: dragDimensions.height
                    }} 
                />,
                document.body
            )}

            <style>{`
                .grabbing-active { 
                    cursor: grabbing !important;
                    user-select: none;
                }
                .cursor-grab { cursor: grab; }
                .cursor-grabbing { cursor: grabbing; }
                .touch-none { touch-action: none; }
            `}</style>
        </div>,
        document.body
    );
};

export default CrearTrabajoModal;
