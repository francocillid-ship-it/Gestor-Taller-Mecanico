import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../supabaseClient';
import { XMarkIcon, TrashIcon, ChevronDownIcon, PlusIcon, CameraIcon, UserIcon, PhoneIcon, EnvelopeIcon, CheckIcon } from '@heroicons/react/24/solid';
import type { Cliente, Vehiculo } from '../types';
import { isGeminiAvailable, VehiculoData } from '../gemini';
import CameraRecognitionModal from './CameraRecognitionModal';

interface CrearClienteModalProps {
    onClose: () => void;
    onSuccess: (newClient?: Cliente) => void; 
    clienteToEdit?: Cliente | null;
}

type VehicleFormState = Omit<Vehiculo, 'id' | 'año'> & { id?: string; año: string };

const CrearClienteModal: React.FC<CrearClienteModalProps> = ({ onClose, onSuccess, clienteToEdit }) => {
    const [nombre, setNombre] = useState('');
    const [apellido, setApellido] = useState('');
    const [email, setEmail] = useState('');
    const [telefono, setTelefono] = useState('');
    const [vehicles, setVehicles] = useState<VehicleFormState[]>([{ marca: '', modelo: '', año: '', matricula: '', numero_chasis: '', numero_motor: '' }]);
    const [deletedVehicleIds, setDeletedVehicleIds] = useState<string[]>([]);
    const [expandedVehicleIdx, setExpandedVehicleIdx] = useState<number>(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
    const [error, setError] = useState('');
    const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
    const [scanningVehicleIndex, setScanningVehicleIndex] = useState<number | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    const geminiEnabled = isGeminiAvailable();

    const isEditMode = Boolean(clienteToEdit);

    useEffect(() => {
        if (clienteToEdit) {
            setNombre(clienteToEdit.nombre);
            setApellido(clienteToEdit.apellido || '');
            setEmail(clienteToEdit.email || '');
            setTelefono(clienteToEdit.telefono || '');
            if (clienteToEdit.vehiculos && clienteToEdit.vehiculos.length > 0) {
                setVehicles(clienteToEdit.vehiculos.map(v => ({
                    ...v, 
                    año: v.año ? String(v.año) : '',
                    numero_chasis: v.numero_chasis || '',
                    numero_motor: v.numero_motor || ''
                })));
            }
        }
        requestAnimationFrame(() => setIsVisible(true));
    }, [clienteToEdit]);

    const handleClose = () => {
        setIsVisible(false);
        setTimeout(onClose, 300);
    };

    const handleVehicleChange = (index: number, field: keyof VehicleFormState, value: string) => {
        const updatedVehicles = [...vehicles];
        let processedValue = value;
        if (['marca', 'modelo', 'matricula', 'numero_chasis', 'numero_motor'].includes(field)) {
            processedValue = value.toUpperCase();
        }
        updatedVehicles[index] = { ...updatedVehicles[index], [field]: processedValue };
        setVehicles(updatedVehicles);
    };

    const handleAddNewVehicle = () => {
        setVehicles([...vehicles, { marca: '', modelo: '', año: '', matricula: '', numero_chasis: '', numero_motor: '' }]);
        setExpandedVehicleIdx(vehicles.length);
    };

    const handleRemoveVehicle = (indexToRemove: number) => {
        const vehicleToRemove = vehicles[indexToRemove];
        if (vehicleToRemove.id) setDeletedVehicleIds(prev => [...prev, vehicleToRemove.id!]);
        setVehicles(prev => prev.filter((_, index) => index !== indexToRemove));
        if (expandedVehicleIdx >= indexToRemove) setExpandedVehicleIdx(Math.max(0, expandedVehicleIdx - 1));
    };

    const handleDelete = async () => {
        if (!clienteToEdit) return;
        setIsDeleting(true);
        try {
            // Eliminar vehículos asociados manualmente
            await supabase.from('vehiculos').delete().eq('cliente_id', clienteToEdit.id);
            // Eliminar trabajos asociados
            await supabase.from('trabajos').delete().eq('cliente_id', clienteToEdit.id);
            // Eliminar cliente
            const { error } = await supabase.from('clientes').delete().eq('id', clienteToEdit.id);
            if (error) throw error;
            onSuccess();
        } catch (err: any) {
            setError('Error al eliminar: ' + err.message);
            setIsDeleting(false);
            setIsConfirmingDelete(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError('');

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Sesión no encontrada.");

            let finalClienteId: string;

            if (isEditMode && clienteToEdit) {
                const { error: clientError } = await supabase.from('clientes').update({
                    nombre, 
                    apellido: apellido.trim() || null, 
                    email: email.trim() || null, 
                    telefono: telefono.trim() || null 
                }).eq('id', clienteToEdit.id);
                
                if (clientError) throw clientError;
                finalClienteId = clienteToEdit.id;
            } else {
                const { data: newClient, error: clientError } = await supabase
                    .from('clientes')
                    .insert({
                        taller_id: user.id, 
                        nombre, 
                        apellido: apellido.trim() || null, 
                        email: email.trim() || null, 
                        telefono: telefono.trim() || null
                    })
                    .select()
                    .single();
                
                if (clientError) throw clientError;
                finalClienteId = newClient.id;
            }

            if (deletedVehicleIds.length > 0) {
                await supabase.from('vehiculos').delete().in('id', deletedVehicleIds);
            }

            for (const v of vehicles) {
                const vehicleData = {
                    cliente_id: finalClienteId,
                    marca: v.marca,
                    modelo: v.modelo,
                    año: v.año ? parseInt(v.año) : null,
                    matricula: v.matricula || null,
                    numero_chasis: v.numero_chasis || null,
                    numero_motor: v.numero_motor || null
                };

                if (v.id) {
                    const { error: vErr } = await supabase.from('vehiculos').update(vehicleData).eq('id', v.id);
                    if (vErr) throw vErr;
                } else {
                    const { error: vErr } = await supabase.from('vehiculos').insert(vehicleData);
                    if (vErr) throw vErr;
                }
            }

            onSuccess();
        } catch (err: any) {
            console.error("Error saving client:", err);
            setError(err.message || 'Error al guardar los datos.');
            setIsSubmitting(false);
        }
    };

    const handleDataRecognized = (data: VehiculoData) => {
        if (scanningVehicleIndex !== null) {
            const updated = [...vehicles];
            const current = updated[scanningVehicleIndex];
            updated[scanningVehicleIndex] = {
                ...current,
                marca: data.marca?.toUpperCase() || current.marca,
                modelo: data.modelo?.toUpperCase() || current.modelo,
                año: data.año || current.año,
                matricula: data.matricula?.toUpperCase() || current.matricula,
                numero_chasis: data.numero_chasis?.toUpperCase() || current.numero_chasis,
                numero_motor: data.numero_motor?.toUpperCase() || current.numero_motor,
            };
            setVehicles(updated);
        }
        setIsCameraModalOpen(false);
    };

    return createPortal(
        <div className="fixed inset-0 z-[100] flex justify-center items-end sm:items-center">
            <div className={`fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`} onClick={handleClose}/>
            <div className={`bg-white dark:bg-gray-800 w-full h-[90dvh] sm:h-auto sm:max-h-[95vh] sm:max-w-xl sm:rounded-t-xl flex flex-col overflow-hidden relative z-10 transform transition-all duration-300 ease-out ${isVisible ? 'translate-y-0' : 'translate-y-full'}`}>
                <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50 flex-shrink-0">
                    <h2 className="font-bold text-lg">{isEditMode ? 'Editar Cliente' : 'Nuevo Cliente'}</h2>
                    <button onClick={handleClose} className="p-1"><XMarkIcon className="h-6 w-6"/></button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-6 overscroll-none">
                    <form id="client-form" onSubmit={handleSubmit} className="space-y-6 pb-20">
                        <section className="space-y-4">
                            <h3 className="text-xs font-bold text-taller-gray uppercase flex items-center gap-2"><UserIcon className="h-3 w-3"/> Datos Personales</h3>
                            <div className="grid grid-cols-2 gap-3">
                                <input type="text" placeholder="Nombre *" value={nombre} onChange={e => setNombre(e.target.value)} className="p-2.5 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm" required/>
                                <input type="text" placeholder="Apellido" value={apellido} onChange={e => setApellido(e.target.value)} className="p-2.5 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm" />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="relative">
                                    <PhoneIcon className="absolute left-3 top-3 h-4 w-4 text-gray-400"/>
                                    <input type="tel" placeholder="Teléfono" value={telefono} onChange={e => setTelefono(e.target.value)} className="w-full pl-9 p-2.5 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm" />
                                </div>
                                <div className="relative">
                                    <EnvelopeIcon className="absolute left-3 top-3 h-4 w-4 text-gray-400"/>
                                    <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full pl-9 p-2.5 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"/>
                                </div>
                            </div>
                        </section>

                        <section className="space-y-4">
                            <div className="flex justify-between items-center">
                                <h3 className="text-xs font-bold text-taller-gray uppercase">Vehículos ({vehicles.length})</h3>
                                <button type="button" onClick={handleAddNewVehicle} className="text-xs font-bold text-taller-primary flex items-center gap-1 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded"><PlusIcon className="h-3 w-3"/> Añadir</button>
                            </div>

                            <div className="space-y-3">
                                {vehicles.map((v, idx) => (
                                    <div key={idx} className="border dark:border-gray-700 rounded-xl overflow-hidden shadow-sm bg-gray-50 dark:bg-gray-900/20">
                                        <button type="button" onClick={() => setExpandedVehicleIdx(expandedVehicleIdx === idx ? -1 : idx)} className="w-full p-3 flex justify-between items-center text-sm font-bold bg-white dark:bg-gray-700">
                                            <span className="truncate">{v.marca || 'Nueva Marca'} {v.modelo}</span>
                                            <ChevronDownIcon className={`h-4 w-4 transition-transform ${expandedVehicleIdx === idx ? 'rotate-180' : ''}`}/>
                                        </button>
                                        
                                        <div className={`p-4 space-y-4 bg-inherit ${expandedVehicleIdx === idx ? 'block' : 'hidden'}`}>
                                            <div className="flex justify-end">
                                                {geminiEnabled && (
                                                    <button type="button" onClick={() => { setScanningVehicleIndex(idx); setIsCameraModalOpen(true); }} className="text-xs font-bold text-blue-600 flex items-center gap-1 border border-blue-200 px-2 py-1 rounded"><CameraIcon className="h-3 w-3"/> Escanear Cédula</button>
                                                )}
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <input type="text" placeholder="Marca *" value={v.marca} onChange={e => handleVehicleChange(idx, 'marca', e.target.value)} className="p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm" required/>
                                                <input type="text" placeholder="Modelo *" value={v.modelo} onChange={e => handleVehicleChange(idx, 'modelo', e.target.value)} className="p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm" required/>
                                                <input type="text" placeholder="Patente" value={v.matricula} onChange={e => handleVehicleChange(idx, 'matricula', e.target.value)} className="p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"/>
                                                <input type="number" placeholder="Año" value={v.año} onChange={e => handleVehicleChange(idx, 'año', e.target.value)} className="p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"/>
                                                <input type="text" placeholder="Nº Chasis" value={v.numero_chasis} onChange={e => handleVehicleChange(idx, 'numero_chasis', e.target.value)} className="p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"/>
                                                <input type="text" placeholder="Nº Motor" value={v.numero_motor} onChange={e => handleVehicleChange(idx, 'numero_motor', e.target.value)} className="p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"/>
                                            </div>
                                            <button type="button" onClick={() => handleRemoveVehicle(idx)} className="text-xs font-bold text-red-500 flex items-center gap-1 pt-2"><TrashIcon className="h-3 w-3"/> Eliminar vehículo</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                        {error && (
                            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                                <p className="text-red-600 dark:text-red-400 text-xs font-bold text-center break-words">{error}</p>
                            </div>
                        )}
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
                                    <TrashIcon className="h-5 w-5"/> Eliminar
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
                    <button onClick={handleClose} className={`${isEditMode ? 'flex-1' : 'flex-1'} py-3 border rounded-xl font-bold text-gray-500`}>Cancelar</button>
                    <button type="submit" form="client-form" disabled={isSubmitting} className="flex-[2] py-3 bg-taller-primary text-white rounded-xl font-bold shadow-lg disabled:opacity-50">
                        {isSubmitting ? 'Guardando...' : 'Guardar'}
                    </button>
                </div>
            </div>

            {isCameraModalOpen && (
                <CameraRecognitionModal
                    onClose={() => setIsCameraModalOpen(false)}
                    onDataRecognized={handleDataRecognized}
                />
            )}
        </div>,
        document.body
    );
};

export default CrearClienteModal;