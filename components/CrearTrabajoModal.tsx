import React, { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../supabaseClient';
import type { Cliente, Parte, Trabajo } from '../types';
import { JobStatus } from '../types';
import { XMarkIcon, TrashIcon, WrenchScrewdriverIcon, TagIcon, ArchiveBoxIcon, Bars3Icon, ShoppingBagIcon, BoltIcon, UsersIcon, BeakerIcon } from '@heroicons/react/24/solid';
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
    const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [exitingItemIds, setExitingItemIds] = useState<Set<string>>(new Set());
    
    const listRef = useRef<HTMLDivElement>(null);
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

    const handleDragStart = (index: number) => setDraggedItemIndex(index);
    const handleDragEnd = () => setDraggedItemIndex(null);
    const handleDragOver = (index: number) => {
        if (draggedItemIndex === null || draggedItemIndex === index) return;
        const newPartes = [...partes];
        const [removed] = newPartes.splice(draggedItemIndex, 1);
        newPartes.splice(index, 0, removed);
        setPartes(newPartes);
        setDraggedItemIndex(index);
    };

    const handleTouchStart = (index: number, e: React.TouchEvent) => {
        setDraggedItemIndex(index);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (draggedItemIndex === null) return;
        if (e.cancelable) e.preventDefault();
        const touch = e.touches[0];
        const element = document.elementFromPoint(touch.clientX, touch.clientY);
        const item = element?.closest('[data-id]') as HTMLElement;
        if (item && item.dataset.id) {
            const idx = partes.findIndex(p => p._id === item.dataset.id);
            if (idx !== -1 && idx !== draggedItemIndex) handleDragOver(idx);
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
                quick_budget_data: creationMode === 'quick' ? { nombre: quickNombre, apellido: quickApellido, marca: quickMarca, modelo: quickModelo, matricula: quickMatricula } : null
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
            <div className={`bg-white dark:bg-gray-800 w-full h-[90dvh] sm:h-auto sm:max-h-[90vh] sm:max-w-2xl sm:rounded-t-xl flex flex-col overflow-hidden relative z-10 transform transition-all duration-300 ease-out ${isVisible ? 'translate-y-0' : 'translate-y-full'}`}>
                <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
                    <h2 className="font-bold">{isEditMode ? 'Editar' : 'Nuevo'} Trabajo</h2>
                    <button onClick={handleClose} className="p-1"><XMarkIcon className="h-6 w-6"/></button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4" onTouchMove={handleTouchMove} onTouchEnd={handleDragEnd}>
                    <form onSubmit={handleSubmit} className="space-y-4">
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
                            <div className="grid grid-cols-2 gap-2">
                                <input type="text" placeholder="Nombre" value={quickNombre} onChange={e => setQuickNombre(e.target.value)} className="p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm" required/>
                                <input type="text" placeholder="Marca" value={quickMarca} onChange={e => setQuickMarca(e.target.value)} className="p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm" required/>
                            </div>
                        )}
                        <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Descripción..." className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm" rows={2}/>
                        
                        <div className="space-y-2" ref={listRef}>
                            {partes.map((p, idx) => (
                                <div 
                                    key={p._id} data-id={p._id}
                                    draggable onDragStart={() => handleDragStart(idx)} onDragOver={(e) => { e.preventDefault(); handleDragOver(idx); }} onDragEnd={handleDragEnd}
                                    className={`flex items-center gap-2 p-2 bg-white dark:bg-gray-700 border dark:border-gray-600 rounded-lg shadow-sm transition-all duration-300 ${exitingItemIds.has(p._id) ? 'opacity-0 scale-95' : 'opacity-100'} ${draggedItemIndex === idx ? 'opacity-50 scale-105 ring-2 ring-taller-primary z-50' : ''}`}
                                >
                                    <div className="cursor-grab active:cursor-grabbing p-1 text-gray-400 touch-none" onTouchStart={(e) => handleTouchStart(idx, e)}>
                                        <Bars3Icon className="h-5 w-5"/>
                                    </div>
                                    <div className="flex-1 flex flex-col">
                                        <input type="text" value={p.nombre} onChange={e => handleParteChange(idx, 'nombre', e.target.value)} className={`bg-transparent text-sm font-medium focus:outline-none ${p.isCategory ? 'font-bold uppercase' : ''}`} placeholder={p.isCategory ? 'CATEGORÍA' : 'Nombre ítem...'}/>
                                        {!p.isCategory && (
                                            <div className="flex gap-2 mt-1">
                                                <input type="text" value={p.precioUnitario} onChange={e => handleParteChange(idx, 'precioUnitario', formatCurrency(e.target.value))} className="w-24 text-xs border-b dark:border-gray-500 bg-transparent" placeholder="$ 0,00"/>
                                                <input type="number" value={p.cantidad} onChange={e => handleParteChange(idx, 'cantidad', e.target.value)} className="w-12 text-xs border-b dark:border-gray-500 bg-transparent" placeholder="Cant"/>
                                            </div>
                                        )}
                                    </div>
                                    <button type="button" onClick={() => removeParte(idx)} className="p-1 text-red-500"><TrashIcon className="h-5 w-5"/></button>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <button type="button" onClick={() => setPartes([...partes, { _id: generateId(), nombre: '', cantidad: 1, precioUnitario: '', isService: false }])} className="flex-1 py-2 text-xs font-bold border rounded-lg flex items-center justify-center gap-1"><ArchiveBoxIcon className="h-4 w-4"/> +Repuesto</button>
                            <button type="button" onClick={() => setPartes([...partes, { _id: generateId(), nombre: '', cantidad: 1, precioUnitario: '', isService: true }])} className="flex-1 py-2 text-xs font-bold border rounded-lg flex items-center justify-center gap-1"><WrenchScrewdriverIcon className="h-4 w-4"/> +Servicio</button>
                            <button type="button" onClick={() => setPartes([...partes, { _id: generateId(), nombre: '', cantidad: 0, precioUnitario: '', isCategory: true }])} className="flex-1 py-2 text-xs font-bold border rounded-lg flex items-center justify-center gap-1"><TagIcon className="h-4 w-4"/> +Cat</button>
                        </div>
                        {error && <p className="text-red-500 text-xs font-bold">{error}</p>}
                    </form>
                </div>
                <div className="p-4 border-t dark:border-gray-700 bg-white dark:bg-gray-800 flex gap-2">
                    <button onClick={handleClose} className="flex-1 py-3 border rounded-xl font-bold text-gray-500">Cancelar</button>
                    <button onClick={handleSubmit} disabled={isSubmitting} className="flex-[2] py-3 bg-taller-primary text-white rounded-xl font-bold shadow-lg disabled:opacity-50">{isSubmitting ? '...' : 'Guardar'}</button>
                </div>
            </div>
            <style>{`
                [draggable="true"] { touch-action: none; user-select: none; -webkit-user-select: none; }
                .cursor-grab { cursor: grab; }
                .cursor-grabbing { cursor: grabbing; }
            `}</style>
        </div>,
        document.body
    );
};

export default CrearTrabajoModal;