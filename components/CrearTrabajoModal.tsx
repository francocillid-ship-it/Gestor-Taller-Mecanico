import React, { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../supabaseClient';
import type { Cliente, Parte, Trabajo } from '../types';
import { JobStatus } from '../types';
import { XMarkIcon, TrashIcon, WrenchScrewdriverIcon, TagIcon, ArchiveBoxIcon, Bars3Icon, ShoppingBagIcon, BoltIcon, UsersIcon, PlusIcon } from '@heroicons/react/24/solid';
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
            className={`w-full bg-transparent text-sm font-medium focus:outline-none resize-none overflow-hidden transition-all duration-200 block ${
                isCategory ? 'font-extrabold uppercase text-purple-700 dark:text-purple-400' : 'text-taller-dark dark:text-taller-light'
            } ${!isFocused ? 'whitespace-nowrap truncate max-h-[1.5rem]' : ''}`}
            style={{ 
                minHeight: '1.5rem',
                lineHeight: '1.5rem'
            }}
        />
    );
};

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
    const [pagos, setPagos] = useState<Parte[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [isVisible, setIsVisible] = useState(false);
    const [exitingItemIds, setExitingItemIds] = useState<Set<string>>(new Set());
    
    // Drag and Drop Logic States
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
    const [dragItemSize, setDragItemSize] = useState({ width: 0, height: 0 });

    const listRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
    const prevPositions = useRef<Map<string, number>>(new Map());
    const isEditMode = Boolean(trabajoToEdit);

    const selectedClientVehiculos = useMemo(() => {
        const client = clientes.find(c => c.id === selectedClienteId);
        return client?.vehiculos || [];
    }, [clientes, selectedClienteId]);

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

    const generateId = () => Math.random().toString(36).substr(2, 9);

    // FLIP Animation for list updates
    useLayoutEffect(() => {
        if (!listRef.current || draggedIndex !== null) return;
        const children = Array.from(listRef.current.children) as HTMLElement[];
        
        children.forEach(child => {
            const id = child.dataset.id;
            if (!id) return;
            const oldTop = prevPositions.current.get(id);
            const newTop = child.offsetTop;
            if (oldTop !== undefined && oldTop !== newTop) {
                const dy = oldTop - newTop;
                child.style.transform = `translateY(${dy}px)`;
                child.style.transition = 'none';
                requestAnimationFrame(() => {
                    child.style.transform = '';
                    child.style.transition = 'transform 300ms cubic-bezier(0.2, 0.8, 0.2, 1)';
                });
            }
        });

        prevPositions.current = new Map(children.map(c => [c.dataset.id!, c.offsetTop]));
    }, [partes, draggedIndex]);

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
            setPagos(trabajoToEdit.partes.filter(p => p.nombre === '__PAGO_REGISTRADO__'));
            setStatus(trabajoToEdit.status);
        } else if (initialClientId) {
            setSelectedClienteId(initialClientId);
        }
        requestAnimationFrame(() => setIsVisible(true));
    }, [trabajoToEdit, initialClientId]);

    const handleClose = () => {
        setIsVisible(false);
        setTimeout(onClose, 300);
    };

    const handleParteChange = (index: number, field: keyof ParteState, value: any) => {
        const newPartes = [...partes];
        (newPartes[index] as any)[field] = value;
        
        if (field === 'nombre' && value && !newPartes[index].maintenanceType && !newPartes[index].isCategory) {
            const val = String(value).toLowerCase();
            const found = ALL_MAINTENANCE_OPTS.find(opt => opt.keywords.some(k => val.includes(k)));
            if (found) newPartes[index].maintenanceType = found.key;
        }
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

    // --- NEW DRAG AND DROP LOGIC ---

    const handleDragStart = (e: React.PointerEvent, index: number) => {
        const target = e.currentTarget as HTMLElement;
        const item = target.closest('[data-id]') as HTMLElement;
        if (!item) return;

        const rect = item.getBoundingClientRect();
        setDragItemSize({ width: rect.width, height: rect.height });
        setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        setDragPos({ x: rect.left, y: rect.top });
        setDraggedIndex(index);
        
        target.setPointerCapture(e.pointerId);
    };

    const handleDragMove = (e: React.PointerEvent) => {
        if (draggedIndex === null) return;

        const newX = e.clientX - dragOffset.x;
        const newY = e.clientY - dragOffset.y;
        setDragPos({ x: newX, y: newY });

        // Calculate potential swap
        const centerY = newY + dragItemSize.height / 2;
        
        itemRefs.current.forEach((ref, idx) => {
            if (!ref || idx === draggedIndex) return;
            const targetRect = ref.getBoundingClientRect();
            const targetCenterY = targetRect.top + targetRect.height / 2;

            if (Math.abs(centerY - targetCenterY) < 30) {
                const newPartes = [...partes];
                const temp = newPartes[draggedIndex];
                newPartes[draggedIndex] = newPartes[idx];
                newPartes[idx] = temp;
                setPartes(newPartes);
                setDraggedIndex(idx);
            }
        });
    };

    const handleDragEnd = (e: React.PointerEvent) => {
        setDraggedIndex(null);
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
            const jobData = {
                cliente_id: selectedClienteId || null,
                vehiculo_id: selectedVehiculoId || null,
                taller_id: user.id,
                descripcion,
                status,
                partes: [...cleanPartes, ...pagos],
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

                <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4 overscroll-none touch-auto">
                    <form onSubmit={handleSubmit} className="space-y-4 pb-12">
                        {creationMode === 'existing' ? (
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
                        <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Descripción del trabajo..." className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm" rows={2}/>
                        
                        <div className="space-y-3 select-none relative" ref={listRef}>
                            {partes.map((p, idx) => (
                                <div 
                                    key={p._id} 
                                    data-id={p._id}
                                    ref={el => itemRefs.current[idx] = el}
                                    style={draggedIndex === idx ? {
                                        position: 'fixed',
                                        left: dragPos.x,
                                        top: dragPos.y,
                                        width: dragItemSize.width,
                                        height: dragItemSize.height,
                                        zIndex: 9999,
                                        pointerEvents: 'none',
                                        boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
                                        opacity: 0.9,
                                        transform: 'scale(1.02)',
                                        transition: 'transform 0.1s ease',
                                    } : {
                                        transition: 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)'
                                    }}
                                    className={`flex items-start gap-2 p-2 bg-white dark:bg-gray-700 border dark:border-gray-600 rounded-lg shadow-sm ${exitingItemIds.has(p._id) ? 'opacity-0 scale-95 transition-all duration-300' : 'opacity-100'}`}
                                >
                                    <div 
                                        className="p-1 text-gray-400 cursor-grab active:cursor-grabbing touch-none select-none mt-1"
                                        onPointerDown={(e) => handleDragStart(e, idx)}
                                        onPointerMove={handleDragMove}
                                        onPointerUp={handleDragEnd}
                                        onPointerCancel={handleDragEnd}
                                    >
                                        <Bars3Icon className="h-6 w-6"/>
                                    </div>
                                    <div className="flex-1 flex flex-col min-w-0">
                                        <div className="flex items-start gap-2 w-full">
                                            <div className="mt-1 flex-shrink-0">
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
                                    <button type="button" onClick={() => removeParte(idx)} className="p-1 text-red-500 flex-shrink-0 mt-1"><TrashIcon className="h-5 w-5"/></button>
                                </div>
                            ))}
                            
                            {/* Dummy spacer to maintain list height during dragging */}
                            {draggedIndex !== null && (
                                <div style={{ height: dragItemSize.height }} className="opacity-0" />
                            )}

                            {/* Action Buttons */}
                            <div className="grid grid-cols-3 gap-2 pt-2 animate-fade-in">
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

                        {error && <p className="text-red-500 text-xs font-bold">{error}</p>}
                    </form>
                </div>
                <div className="p-4 border-t dark:border-gray-700 bg-white dark:bg-gray-800 flex gap-2 flex-shrink-0">
                    <button onClick={handleClose} className="flex-1 py-3 border rounded-xl font-bold text-gray-500 hover:bg-gray-50 transition-colors">Cancelar</button>
                    <button onClick={handleSubmit} disabled={isSubmitting} className="flex-[2] py-3 bg-taller-primary text-white rounded-xl font-bold shadow-lg disabled:opacity-50 transition-all active:scale-[0.98]">{isSubmitting ? 'Guardando...' : 'Guardar Trabajo'}</button>
                </div>
            </div>
            <style>{`
                .cursor-grab { cursor: grab; }
                .cursor-grabbing { cursor: grabbing; }
                .touch-none { touch-action: none; }
                .select-none { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
                .overscroll-none { overscroll-behavior: contain; }
            `}</style>
        </div>,
        document.body
    );
};

export default CrearTrabajoModal;