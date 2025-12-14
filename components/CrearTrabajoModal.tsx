import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../supabaseClient';
import type { Cliente, Trabajo, Parte, Vehiculo } from '../types';
import { JobStatus } from '../types';
import { ALL_MAINTENANCE_OPTS } from '../constants';
import { 
    XMarkIcon, 
    PlusIcon, 
    TrashIcon, 
    Bars3Icon, 
    WrenchScrewdriverIcon, 
    ArchiveBoxIcon, 
    TagIcon, 
    ShoppingBagIcon 
} from '@heroicons/react/24/solid';

interface CrearTrabajoModalProps {
    onClose: () => void;
    onSuccess: () => void;
    onDataRefresh: () => void;
    clientes: Cliente[];
    initialClientId?: string;
    trabajoToEdit?: Trabajo;
}

// Internal type for form state, extending Parte with a temp ID for drag-and-drop
interface ParteForm extends Parte {
    _tempId: string;
}

const CrearTrabajoModal: React.FC<CrearTrabajoModalProps> = ({ 
    onClose, 
    onSuccess, 
    onDataRefresh,
    clientes, 
    initialClientId, 
    trabajoToEdit 
}) => {
    const [clienteId, setClienteId] = useState(initialClientId || '');
    const [vehiculoId, setVehiculoId] = useState('');
    const [descripcion, setDescripcion] = useState('');
    const [status, setStatus] = useState<JobStatus>(JobStatus.Presupuesto);
    const [fechaEntrada, setFechaEntrada] = useState(new Date().toISOString().split('T')[0]);
    const [fechaProgramada, setFechaProgramada] = useState('');
    const [fechaSalida, setFechaSalida] = useState('');
    const [kilometraje, setKilometraje] = useState('');
    const [partes, setPartes] = useState<ParteForm[]>([]);
    const [costoManoDeObra, setCostoManoDeObra] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isVisible, setIsVisible] = useState(false);

    // Drag and Drop State
    const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);

    const formatCurrency = (val: string) => {
        // Simple formatter for display during input
        // If user types numbers, we format them as currency string $ X.XXX,XX
        // For internal state we keep it simple or parse it on submit
        // Here we just return what user typed for simplicity in controlled inputs with specialized handling
        return val;
    };

    const parseCurrency = (val: string | number): number => {
        if (typeof val === 'number') return val;
        const digits = val.replace(/\D/g, '');
        return digits ? parseInt(digits, 10) / 100 : 0;
    };

    const currencyToString = (val: number): string => {
        return new Intl.NumberFormat('es-AR', { 
            style: 'currency', 
            currency: 'ARS'
        }).format(val);
    };

    useEffect(() => {
        requestAnimationFrame(() => setIsVisible(true));
    }, []);

    useEffect(() => {
        if (trabajoToEdit) {
            setClienteId(trabajoToEdit.clienteId);
            setVehiculoId(trabajoToEdit.vehiculoId);
            setDescripcion(trabajoToEdit.descripcion);
            setStatus(trabajoToEdit.status);
            setFechaEntrada(new Date(trabajoToEdit.fechaEntrada).toISOString().split('T')[0]);
            
            if (trabajoToEdit.fechaProgramada) {
                setFechaProgramada(new Date(trabajoToEdit.fechaProgramada).toISOString().slice(0, 16)); // YYYY-MM-DDTHH:mm
            }
            if (trabajoToEdit.fechaSalida) {
                setFechaSalida(new Date(trabajoToEdit.fechaSalida).toISOString().split('T')[0]);
            }
            
            setKilometraje(trabajoToEdit.kilometraje ? String(trabajoToEdit.kilometraje) : '');
            
            if (trabajoToEdit.costoManoDeObra) {
                setCostoManoDeObra(currencyToString(trabajoToEdit.costoManoDeObra));
            }

            const mappedPartes = trabajoToEdit.partes.map(p => ({
                ...p,
                _tempId: Math.random().toString(36).substr(2, 9),
                precioUnitario: p.precioUnitario // Keep as number internally for now, or convert to string if using input type text with mask
            })) as any[]; // Type casting to bypass strict check for initial load

            // Convert numeric prices to formatted strings for the inputs
            const formattedPartes = mappedPartes.map(p => ({
                ...p,
                precioUnitario: currencyToString(p.precioUnitario)
            }));

            setPartes(formattedPartes);
        } else {
             // Defaults for new job
             setPartes([
                 // Initialize with one empty part row for convenience
                 { _tempId: 'init-1', nombre: '', cantidad: 1, precioUnitario: currencyToString(0), isService: false }
             ]);
        }
    }, [trabajoToEdit]);

    const handleClose = () => {
        setIsVisible(false);
        setTimeout(onClose, 300);
    };

    const selectedCliente = clientes.find(c => c.id === clienteId);
    const vehiculosCliente = selectedCliente ? selectedCliente.vehiculos : [];

    // --- PARTS MANAGEMENT ---

    const addParte = (isService: boolean = false, isCategory: boolean = false) => {
        setPartes([
            ...partes,
            {
                _tempId: Math.random().toString(36).substr(2, 9),
                nombre: '',
                cantidad: 1,
                precioUnitario: currencyToString(0),
                isService,
                isCategory
            }
        ]);
    };

    const removeParte = (index: number) => {
        const newPartes = [...partes];
        newPartes.splice(index, 1);
        setPartes(newPartes);
    };

    const handleParteChange = (index: number, field: keyof ParteForm, value: any) => {
        const newPartes = [...partes];
        newPartes[index] = { ...newPartes[index], [field]: value };
        setPartes(newPartes);
    };

    // --- DRAG AND DROP ---

    const handleDragStart = (index: number) => {
        setDraggedItemIndex(index);
    };

    const handleDragEnter = (index: number) => {
        if (draggedItemIndex === null || draggedItemIndex === index) return;
        
        const newPartes = [...partes];
        const draggedItem = newPartes[draggedItemIndex];
        
        // Remove dragged item
        newPartes.splice(draggedItemIndex, 1);
        // Insert at new position
        newPartes.splice(index, 0, draggedItem);
        
        setDraggedItemIndex(index);
        setPartes(newPartes);
    };

    const handleDragEnd = () => {
        setDraggedItemIndex(null);
    };

    // Touch support for Drag and Drop
    const handleTouchStart = (index: number) => {
        setDraggedItemIndex(index);
    };
    
    const handleTouchMove = (e: React.TouchEvent) => {
        if (draggedItemIndex === null) return;
        e.preventDefault(); // Prevent scrolling while dragging
        
        const touch = e.touches[0];
        const target = document.elementFromPoint(touch.clientX, touch.clientY);
        
        if (target) {
            const row = target.closest('[data-index]');
            if (row) {
                const index = parseInt(row.getAttribute('data-index') || '-1', 10);
                if (index !== -1 && index !== draggedItemIndex) {
                    handleDragEnter(index);
                }
            }
        }
    };

    const handleTouchEnd = () => {
        setDraggedItemIndex(null);
    };

    // --- CALCULATION ---
    const calculateTotal = () => {
        const partsTotal = partes
            .filter(p => !p.isCategory && !p.isService) // Sum parts
            .reduce((sum, p) => sum + (p.cantidad * parseCurrency(p.precioUnitario as unknown as string)), 0);
        
        // Sum services defined in parts list
        const servicesInPartsTotal = partes
             .filter(p => !p.isCategory && p.isService)
             .reduce((sum, p) => sum + (p.cantidad * parseCurrency(p.precioUnitario as unknown as string)), 0);

        // Explicit Labor Cost field
        const explicitLabor = parseCurrency(costoManoDeObra);
        
        // If there are services in the list, we assume they replace the explicit labor cost field or add to it?
        // Usually if breaking down services, explicit field might be 0 or supplementary.
        
        return partsTotal + servicesInPartsTotal + explicitLabor;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!clienteId || !vehiculoId) {
            alert('Por favor seleccione un cliente y un vehículo.');
            return;
        }

        setIsSubmitting(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("No user found");

            // Prepare partes for DB (remove temp ID, parse prices)
            const cleanPartes: Parte[] = partes.map(p => ({
                nombre: p.nombre,
                cantidad: Number(p.cantidad),
                precioUnitario: parseCurrency(p.precioUnitario as unknown as string),
                isService: p.isService,
                isCategory: p.isCategory,
                maintenanceType: p.maintenanceType,
                clientPaidDirectly: p.clientPaidDirectly
            }));

            const finalCostoManoDeObra = parseCurrency(costoManoDeObra);
            const costoEstimado = calculateTotal();

            const jobData = {
                cliente_id: clienteId,
                vehiculo_id: vehiculoId,
                descripcion,
                status,
                fecha_entrada: new Date(fechaEntrada).toISOString(),
                fecha_programada: fechaProgramada ? new Date(fechaProgramada).toISOString() : null,
                fecha_salida: fechaSalida ? new Date(fechaSalida).toISOString() : null,
                kilometraje: kilometraje ? parseInt(kilometraje, 10) : null,
                partes: cleanPartes,
                costo_mano_de_obra: finalCostoManoDeObra,
                costo_estimado: costoEstimado,
                taller_id: user.id
            };

            if (trabajoToEdit) {
                const { error } = await supabase
                    .from('trabajos')
                    .update(jobData)
                    .eq('id', trabajoToEdit.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('trabajos')
                    .insert(jobData);
                if (error) throw error;
            }

            onSuccess();
            handleClose();

        } catch (error: any) {
            console.error('Error saving job:', error);
            alert(`Error al guardar: ${error.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-50 flex justify-center items-end sm:items-center sm:p-4">
             <div 
                className={`fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ease-out ${isVisible ? 'opacity-100' : 'opacity-0'}`} 
                onClick={handleClose}
            />
            <div 
                className={`bg-white dark:bg-gray-800 w-full h-[100dvh] sm:h-auto sm:max-h-[90vh] sm:max-w-4xl sm:rounded-xl shadow-2xl flex flex-col overflow-hidden relative z-10 transform transition-all duration-300 ease-out ${isVisible ? 'translate-y-0 opacity-100 sm:scale-100' : 'translate-y-full opacity-0 sm:translate-y-0 sm:scale-95'}`}
            >
                 {/* Header */}
                 <div className="flex justify-between items-center p-4 border-b dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-taller-dark dark:text-taller-light">
                            {trabajoToEdit ? 'Editar Trabajo' : 'Nuevo Trabajo'}
                        </h2>
                        {trabajoToEdit && (
                            <p className="text-xs text-taller-gray dark:text-gray-400">ID: {trabajoToEdit.id.slice(0, 8)}</p>
                        )}
                    </div>
                    <button onClick={handleClose} className="p-2 -mr-2 text-taller-gray dark:text-gray-400 hover:text-taller-dark dark:hover:text-white rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                        <XMarkIcon className="h-6 w-6" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 overscroll-contain">
                    <form id="job-form" onSubmit={handleSubmit} className="space-y-6">
                        {/* 1. Client & Vehicle Selection */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-taller-gray dark:text-gray-400 mb-1">Cliente</label>
                                <select 
                                    value={clienteId} 
                                    onChange={e => {
                                        setClienteId(e.target.value);
                                        setVehiculoId(''); // Reset vehicle on client change
                                    }}
                                    disabled={!!trabajoToEdit || !!initialClientId}
                                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-taller-primary sm:text-sm"
                                    required
                                >
                                    <option value="">Seleccione Cliente</option>
                                    {clientes.map(c => (
                                        <option key={c.id} value={c.id}>{c.nombre} {c.apellido}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-taller-gray dark:text-gray-400 mb-1">Vehículo</label>
                                <select 
                                    value={vehiculoId} 
                                    onChange={e => setVehiculoId(e.target.value)}
                                    disabled={!clienteId}
                                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-taller-primary sm:text-sm disabled:opacity-50"
                                    required
                                >
                                    <option value="">Seleccione Vehículo</option>
                                    {vehiculosCliente.map(v => (
                                        <option key={v.id} value={v.id}>{v.marca} {v.modelo} - {v.matricula}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* 2. Job Details */}
                        <div>
                             <label className="block text-sm font-medium text-taller-gray dark:text-gray-400 mb-1">Descripción del Trabajo</label>
                             <textarea 
                                value={descripcion} 
                                onChange={e => setDescripcion(e.target.value)} 
                                rows={2}
                                className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-taller-primary sm:text-sm"
                                placeholder="Ej: Cambio de aceite y filtros, revisión de frenos..."
                                required
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-taller-gray dark:text-gray-400 mb-1">Estado</label>
                                <select 
                                    value={status} 
                                    onChange={e => setStatus(e.target.value as JobStatus)} 
                                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-taller-primary sm:text-sm"
                                >
                                    {Object.values(JobStatus).map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-taller-gray dark:text-gray-400 mb-1">Fecha Entrada</label>
                                <input 
                                    type="date" 
                                    value={fechaEntrada} 
                                    onChange={e => setFechaEntrada(e.target.value)} 
                                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-taller-primary sm:text-sm"
                                    required 
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-taller-gray dark:text-gray-400 mb-1">Fecha Programada (Opcional)</label>
                                <input 
                                    type="datetime-local" 
                                    value={fechaProgramada} 
                                    onChange={e => setFechaProgramada(e.target.value)} 
                                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-taller-primary sm:text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-taller-gray dark:text-gray-400 mb-1">Kilometraje</label>
                                <input 
                                    type="number" 
                                    value={kilometraje} 
                                    onChange={e => setKilometraje(e.target.value)} 
                                    placeholder="Ej: 150000"
                                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-taller-primary sm:text-sm"
                                />
                            </div>
                        </div>

                        {/* 3. Parts & Services Editor */}
                        <div className="border-t dark:border-gray-700 pt-4">
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="font-bold text-taller-dark dark:text-taller-light">Detalle de Costos (Repuestos y Servicios)</h3>
                            </div>

                            <div className="space-y-2 mb-4">
                                {partes.map((parte, index) => {
                                    // Animation class for new items
                                    const isNew = !trabajoToEdit && index === partes.length - 1;
                                    const animationClass = isNew ? 'animate-in fade-in slide-in-from-left-4 duration-300' : '';

                                    return (
                                    <div 
                                        key={parte._tempId}
                                        data-index={index}
                                        className={`flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2 mb-3 rounded-lg border dark:border-gray-700 transition-colors duration-300 ease-out select-none 
                                            ${draggedItemIndex === index ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 opacity-50' : 'bg-gray-50 dark:bg-gray-700/30'}
                                            ${animationClass}`}
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
                                                        value={parte.precioUnitario as unknown as string} 
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
                                                        value={parte.precioUnitario as unknown as string} 
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
                            </div>

                            <div className="flex gap-2 flex-wrap mb-4">
                                <button type="button" onClick={() => addParte(false, false)} className="flex items-center gap-1 px-3 py-1.5 text-sm font-semibold text-gray-700 dark:text-gray-200 bg-gray-200 dark:bg-gray-700 rounded-full hover:bg-gray-300 dark:hover:bg-gray-600">
                                    <PlusIcon className="h-4 w-4"/> Repuesto
                                </button>
                                <button type="button" onClick={() => addParte(true, false)} className="flex items-center gap-1 px-3 py-1.5 text-sm font-semibold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/50 rounded-full hover:bg-blue-200 dark:hover:bg-blue-900/70">
                                    <PlusIcon className="h-4 w-4"/> Mano de Obra (Ítem)
                                </button>
                                <button type="button" onClick={() => addParte(false, true)} className="flex items-center gap-1 px-3 py-1.5 text-sm font-semibold text-taller-accent bg-orange-100 dark:bg-orange-900/50 rounded-full hover:bg-orange-200 dark:hover:bg-orange-900/70">
                                    <PlusIcon className="h-4 w-4"/> Categoría / Título
                                </button>
                            </div>

                            <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg border dark:border-gray-700 space-y-3">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Costo Mano de Obra (Global)</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2 text-gray-500">$</span>
                                        <input 
                                            type="text" 
                                            value={costoManoDeObra} 
                                            onChange={e => setCostoManoDeObra(formatCurrency(e.target.value))} 
                                            className="w-full pl-6 px-3 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:ring-1 focus:ring-taller-primary"
                                            placeholder="0,00"
                                        />
                                    </div>
                                    <p className="text-[10px] text-gray-400 mt-1">
                                        Opcional. Úselo si no desglosa la mano de obra en ítems individuales.
                                    </p>
                                </div>
                                <div className="flex justify-between items-center pt-2 border-t dark:border-gray-700">
                                    <span className="font-bold text-taller-dark dark:text-taller-light text-lg">Total Estimado:</span>
                                    <span className="font-bold text-taller-primary text-xl">
                                        {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(calculateTotal())}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Footer (Actions) */}
                        <div className="pt-2 flex justify-end gap-3 pb-24 sm:pb-0">
                            <button type="button" onClick={handleClose} className="py-2 px-4 border border-gray-300 dark:border-gray-500 rounded-lg text-sm font-bold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">
                                Cancelar
                            </button>
                            <button type="submit" disabled={isSubmitting} className="py-2 px-6 border border-transparent rounded-lg shadow-md text-sm font-bold text-white bg-taller-primary hover:bg-taller-secondary disabled:opacity-50 transition-all active:scale-95">
                                {isSubmitting ? 'Guardando...' : (trabajoToEdit ? 'Actualizar Trabajo' : 'Crear Trabajo')}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default CrearTrabajoModal;