
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase, supabaseUrl, supabaseKey } from '../supabaseClient';
import { createClient } from '@supabase/supabase-js';
import { XMarkIcon, TrashIcon, ClipboardDocumentCheckIcon, ChevronDownIcon, PlusIcon, CameraIcon } from '@heroicons/react/24/solid';
import type { Cliente, Vehiculo, TallerInfo } from '../types';
import { isGeminiAvailable, VehiculoData } from '../gemini';
import CameraRecognitionModal from './CameraRecognitionModal';

interface CrearClienteModalProps {
    onClose: () => void;
    onSuccess: (newClient?: Cliente) => void; 
    onClientCreated?: (newClientId: string) => void;
    clienteToEdit?: Cliente | null;
}

type VehicleFormState = Omit<Vehiculo, 'id' | 'año'> & { id?: string; año: string };

const CrearClienteModal: React.FC<CrearClienteModalProps> = ({ onClose, onSuccess, onClientCreated, clienteToEdit }) => {
    const [nombre, setNombre] = useState('');
    const [apellido, setApellido] = useState('');
    const [email, setEmail] = useState('');
    const [telefono, setTelefono] = useState('');
    const [marca, setMarca] = useState('');
    const [modelo, setModelo] = useState('');
    const [año, setAño] = useState('');
    const [matricula, setMatricula] = useState('');
    const [numero_chasis, setNumeroChasis] = useState('');
    const [numero_motor, setNumeroMotor] = useState('');
    const [vehicles, setVehicles] = useState<VehicleFormState[]>([]);
    const [deletedVehicleIds, setDeletedVehicleIds] = useState<string[]>([]);
    const [expandedVehicleId, setExpandedVehicleId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [confirmingDelete, setConfirmingDelete] = useState(false);
    const [error, setError] = useState('');
    const [contactApiAvailable, setContactApiAvailable] = useState(false);
    const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
    const [scanningVehicleIndex, setScanningVehicleIndex] = useState<number | null>(null);
    const geminiEnabled = isGeminiAvailable();

    const isEditMode = Boolean(clienteToEdit);

    useEffect(() => {
        setContactApiAvailable('contacts' in navigator && 'select' in (navigator as any).contacts);
        if (clienteToEdit) {
            setNombre(clienteToEdit.nombre);
            setApellido(clienteToEdit.apellido || '');
            setEmail(clienteToEdit.email || '');
            setTelefono(clienteToEdit.telefono);
            setVehicles(clienteToEdit.vehiculos.map(v => ({...v, año: v.año ? String(v.año) : ''})) || []);
        }
    }, [clienteToEdit]);

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, []);

    const handleSelectContact = async () => {
        try {
            const contacts = await (navigator as any).contacts.select(['name', 'email', 'tel'], { multiple: false });
            if (contacts.length > 0) {
                const c = contacts[0];
                if (c.name?.length) {
                    const fullName = c.name[0];
                    const parts = fullName.split(' ');
                    if (parts.length > 1) {
                        setNombre(parts[0]);
                        setApellido(parts.slice(1).join(' '));
                    } else {
                        setNombre(fullName);
                        setApellido('');
                    }
                }
                if (c.tel?.length) setTelefono(c.tel[0]);
                if (c.email?.length) setEmail(c.email[0]);
            }
        } catch (ex) {
            setError('No se pudo acceder a los contactos.');
        }
    };

    const handleDeleteClient = async () => {
        if (!clienteToEdit) return;
        setIsDeleting(true);
        setError(''); 
        try {
            await supabase.from('trabajos').delete().eq('cliente_id', clienteToEdit.id);
            await supabase.from('vehiculos').delete().eq('cliente_id', clienteToEdit.id);
            await supabase.from('clientes').delete().eq('id', clienteToEdit.id);
            const { error: rpcError } = await supabase.rpc('delete_auth_user', { user_id: clienteToEdit.id });

            if (rpcError && rpcError.code !== '42883') {
                throw rpcError;
            }
            onSuccess();
        } catch (err: any) {
            setError(err.message || 'Error al eliminar el cliente.');
        } finally {
            setIsDeleting(false);
        }
    };
    
    const handleVehicleChange = (index: number, field: keyof VehicleFormState, value: string) => {
        let processedValue = value;
        if (field === 'marca' || field === 'modelo' || field === 'matricula' || field === 'numero_chasis' || field === 'numero_motor') {
            processedValue = value.toUpperCase();
        }
        const updatedVehicles = [...vehicles];
        updatedVehicles[index] = { ...updatedVehicles[index], [field]: processedValue };
        setVehicles(updatedVehicles);
    };

    const handleAddNewVehicle = () => {
        const newVehicle: VehicleFormState = { marca: '', modelo: '', año: '', matricula: '', numero_chasis: '', numero_motor: '' };
        setVehicles([...vehicles, newVehicle]);
        setExpandedVehicleId(`new-${vehicles.length}`);
    };

    const handleRemoveVehicle = (indexToRemove: number) => {
        if (vehicles.length <= 1) {
            setError('No se puede eliminar el único vehículo del cliente.');
            setTimeout(() => setError(''), 3000);
            return;
        }
        const vehicleToRemove = vehicles[indexToRemove];
        if (vehicleToRemove.id) setDeletedVehicleIds(prev => [...prev, vehicleToRemove.id!]);
        setVehicles(prev => prev.filter((_, index) => index !== indexToRemove));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        e.stopPropagation(); 
        
        setIsSubmitting(true);
        setError('');
        try {
            let resultClient: Cliente | undefined = undefined;

            if (isEditMode) {
                if (clienteToEdit && clienteToEdit.email !== email && email.trim() !== '') {
                    const { error: rpcError } = await supabase.rpc('update_client_email', {
                        user_id: clienteToEdit.id,
                        new_email: email
                    });
                    if (rpcError && rpcError.code !== '42883') throw new Error(`Error al actualizar email: ${rpcError.message}`);
                }

                await supabase.from('clientes').update({ nombre, apellido, email, telefono }).eq('id', clienteToEdit!.id);
                if (deletedVehicleIds.length > 0) await supabase.from('vehiculos').delete().in('id', deletedVehicleIds);
                
                for (const vehicle of vehicles) {
                    let yearNumber: number | null = null;
                    if (vehicle.año && vehicle.año.trim() !== '') {
                        yearNumber = parseInt(vehicle.año);
                        if (isNaN(yearNumber)) throw new Error(`Año inválido para ${vehicle.marca} ${vehicle.modelo}.`);
                    }
                    const vehicleData = { marca: vehicle.marca, modelo: vehicle.modelo, año: yearNumber, matricula: vehicle.matricula, numero_chasis: vehicle.numero_chasis, numero_motor: vehicle.numero_motor, cliente_id: clienteToEdit!.id };
                    if (vehicle.id) {
                        await supabase.from('vehiculos').update(vehicleData).eq('id', vehicle.id);
                    } else {
                        await supabase.from('vehiculos').insert(vehicleData);
                    }
                }
                
                const { data } = await supabase.from('clientes').select('*, vehiculos(*)').eq('id', clienteToEdit!.id).single();
                if(data) resultClient = data as Cliente;

            } else {
                let yearNumber: number | null = null;
                if (año.trim() !== '') {
                    yearNumber = parseInt(año);
                    if (isNaN(yearNumber) || yearNumber <= 1900 || yearNumber > new Date().getFullYear() + 2) {
                        throw new Error('Por favor, ingrese un año válido.');
                    }
                }

                const { data: { session: currentTallerSession } } = await supabase.auth.getSession();
                if (!currentTallerSession || !currentTallerSession.user) throw new Error("Sesión de taller no encontrada.");
                const tallerUser = currentTallerSession.user;

                const tempPassword = Math.random().toString(36).slice(-4) + '!Aa1' + Math.random().toString(36).slice(-4);
                
                const userEmail = email.trim();
                const shouldCreatePortalAccess = userEmail !== '';
                const signUpEmail = shouldCreatePortalAccess ? userEmail : `${crypto.randomUUID()}@taller-placeholder.com`;

                const tempSupabase = createClient(supabaseUrl, supabaseKey, {
                    auth: {
                        persistSession: false,
                        autoRefreshToken: false,
                        detectSessionInUrl: false
                    }
                });

                const { data: signUpData, error: signUpError } = await tempSupabase.auth.signUp({
                    email: signUpEmail,
                    password: tempPassword,
                    options: {
                        data: {
                            role: 'cliente',
                            taller_nombre_ref: (tallerUser.user_metadata?.taller_info as TallerInfo)?.nombre || 'Mi Taller',
                            taller_info_ref: tallerUser.user_metadata?.taller_info,
                        },
                    }
                });
                
                if (signUpError) throw signUpError;
                if (!signUpData.user) throw new Error('No se pudo crear la cuenta de usuario.');
                
                const newUserId = signUpData.user.id;
                
                if (shouldCreatePortalAccess) {
                    localStorage.setItem(`temp_pass_${newUserId}`, tempPassword);
                }

                if (onClientCreated) onClientCreated(newUserId);

                const { error: clientInsertError } = await supabase
                    .from('clientes')
                    .insert({ id: newUserId, taller_id: tallerUser.id, nombre, apellido, email: userEmail, telefono });

                if (clientInsertError) throw new Error(`Error en perfil: ${clientInsertError.message}`);
                
                const { error: vehicleInsertError } = await supabase
                    .from('vehiculos')
                    .insert({ cliente_id: newUserId, marca, modelo, año: yearNumber, matricula, numero_chasis, numero_motor });
                
                if (vehicleInsertError) throw new Error(`Error en vehículo: ${vehicleInsertError.message}`);
                
                const { data } = await supabase
                    .from('clientes')
                    .select('*, vehiculos(*)')
                    .eq('id', newUserId)
                    .single();

                if (data) resultClient = data as Cliente;
            }
            
            onSuccess(resultClient);

        } catch (err: any) {
            console.error("Error submit client", err);
            setError(err.message || `Error al ${isEditMode ? 'actualizar' : 'crear'} el cliente.`);
            setIsSubmitting(false); 
        } 
    };

    const handleDataRecognized = (data: VehiculoData) => {
        if (isEditMode) {
            if (scanningVehicleIndex === null) return;
            const updatedVehicles = [...vehicles];
            const currentVehicle = updatedVehicles[scanningVehicleIndex];
            
            const processedData = { ...data };
            if (processedData.marca) processedData.marca = processedData.marca.toUpperCase();
            if (processedData.modelo) processedData.modelo = processedData.modelo.toUpperCase();
            if (processedData.matricula) processedData.matricula = processedData.matricula?.toUpperCase();
            if (processedData.numero_chasis) processedData.numero_chasis = processedData.numero_chasis?.toUpperCase();
            if (processedData.numero_motor) processedData.numero_motor = processedData.numero_motor?.toUpperCase();

            updatedVehicles[scanningVehicleIndex] = { ...currentVehicle, ...processedData };
            setVehicles(updatedVehicles);
        } else {
            if (data.marca) setMarca(data.marca.toUpperCase());
            if (data.modelo) setModelo(data.modelo.toUpperCase());
            if (data.año) setAño(data.año);
            if (data.matricula) setMatricula(data.matricula.toUpperCase());
            if (data.numero_chasis) setNumeroChasis(data.numero_chasis.toUpperCase());
            if (data.numero_motor) setNumeroMotor(data.numero_motor.toUpperCase());
        }
        setIsCameraModalOpen(false);
        setScanningVehicleIndex(null);
    };

    const openCameraForIndex = (index: number | null) => {
        setScanningVehicleIndex(index);
        setIsCameraModalOpen(true);
    };

    const submitForm = () => {
        const form = document.getElementById('client-form') as HTMLFormElement;
        if(form) {
            if(form.requestSubmit) form.requestSubmit();
            else form.submit();
        }
    };
    
    const renderCreateForm = () => (
        <>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center border-b dark:border-gray-600 pb-2 pt-4">
                <h3 className="text-md font-semibold text-taller-dark dark:text-taller-light">Datos del Vehículo</h3>
                {geminiEnabled && (
                    <button type="button" onClick={() => openCameraForIndex(null)} className="flex-shrink-0 self-end sm:self-center flex items-center gap-2 px-3 py-1 text-sm font-semibold text-taller-secondary bg-blue-50 border border-taller-secondary/50 rounded-lg shadow-sm hover:bg-blue-100 dark:text-blue-300 dark:bg-blue-900/30 dark:border-blue-500/50 dark:hover:bg-blue-900/50">
                        <CameraIcon className="h-4 w-4" /> Escanear Cédula
                    </button>
                )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label htmlFor="marca" className="block text-sm font-medium text-taller-gray dark:text-gray-400">Marca</label><input type="text" id="marca" value={marca} onChange={e => setMarca(e.target.value.toUpperCase())} className="mt-1 block w-full input-class" required /></div>
                <div><label htmlFor="modelo" className="block text-sm font-medium text-taller-gray dark:text-gray-400">Modelo</label><input type="text" id="modelo" value={modelo} onChange={e => setModelo(e.target.value.toUpperCase())} className="mt-1 block w-full input-class" required /></div>
                <div><label htmlFor="año" className="block text-sm font-medium text-taller-gray dark:text-gray-400">Año (Opcional)</label><input type="number" id="año" value={año} onChange={e => setAño(e.target.value)} className="mt-1 block w-full input-class" /></div>
                <div><label htmlFor="matricula" className="block text-sm font-medium text-taller-gray dark:text-gray-400">Matrícula (Opcional)</label><input type="text" id="matricula" value={matricula} onChange={e => setMatricula(e.target.value.toUpperCase())} className="mt-1 block w-full input-class" /></div>
                <div><label htmlFor="numero_chasis" className="block text-sm font-medium text-taller-gray dark:text-gray-400">Nº Chasis (opcional)</label><input type="text" id="numero_chasis" value={numero_chasis} onChange={e => setNumeroChasis(e.target.value.toUpperCase())} className="mt-1 block w-full input-class" /></div>
                <div><label htmlFor="numero_motor" className="block text-sm font-medium text-taller-gray dark:text-gray-400">Nº Motor (opcional)</label><input type="text" id="numero_motor" value={numero_motor} onChange={e => setNumeroMotor(e.target.value.toUpperCase())} className="mt-1 block w-full input-class" /></div>
            </div>
        </>
    );

    const renderEditForm = () => (
        <div className="pt-4 space-y-3">
            <h3 className="text-md font-semibold text-taller-dark dark:text-taller-light border-b dark:border-gray-600 pb-2">Vehículos Registrados</h3>
            {vehicles.map((vehicle, index) => {
                const uniqueKey = vehicle.id || `new-${index}`;
                return (
                    <div key={uniqueKey} className="border dark:border-gray-700 rounded-lg overflow-hidden">
                        <button type="button" onClick={() => setExpandedVehicleId(expandedVehicleId === uniqueKey ? null : uniqueKey)} className="w-full p-3 flex justify-between items-center text-left bg-taller-light/50 dark:bg-gray-700/50 hover:bg-taller-light dark:hover:bg-gray-700">
                            <span className="font-semibold text-taller-dark dark:text-taller-light">{vehicle.marca || '[Nuevo Vehículo]'} {vehicle.modelo}</span>
                            <ChevronDownIcon className={`h-5 w-5 text-taller-gray dark:text-gray-400 transform transition-transform ${expandedVehicleId === uniqueKey ? 'rotate-180' : ''}`} />
                        </button>
                        {expandedVehicleId === uniqueKey && (
                            <div className="p-4 bg-white dark:bg-gray-800 space-y-4">
                                {geminiEnabled && (
                                    <button type="button" onClick={() => openCameraForIndex(index)} className="flex items-center gap-2 px-3 py-1 text-sm font-semibold text-taller-secondary bg-blue-50 border border-taller-secondary/50 rounded-lg shadow-sm hover:bg-blue-100 dark:text-blue-300 dark:bg-blue-900/30 dark:border-blue-500/50 dark:hover:bg-blue-900/50 mb-2">
                                        <CameraIcon className="h-4 w-4" /> Rellenar con cámara
                                    </button>
                                )}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div><label className="block text-sm font-medium text-taller-gray dark:text-gray-400">Marca</label><input type="text" value={vehicle.marca} onChange={e => handleVehicleChange(index, 'marca', e.target.value)} className="mt-1 block w-full input-class" required /></div>
                                    <div><label className="block text-sm font-medium text-taller-gray dark:text-gray-400">Modelo</label><input type="text" value={vehicle.modelo} onChange={e => handleVehicleChange(index, 'modelo', e.target.value)} className="mt-1 block w-full input-class" required /></div>
                                    <div><label className="block text-sm font-medium text-taller-gray dark:text-gray-400">Año (Opcional)</label><input type="number" value={vehicle.año} onChange={e => handleVehicleChange(index, 'año', e.target.value)} className="mt-1 block w-full input-class" /></div>
                                    <div><label className="block text-sm font-medium text-taller-gray dark:text-gray-400">Matrícula (Opcional)</label><input type="text" value={vehicle.matricula} onChange={e => handleVehicleChange(index, 'matricula', e.target.value)} className="mt-1 block w-full input-class" /></div>
                                    <div><label className="block text-sm font-medium text-taller-gray dark:text-gray-400">Nº Chasis (opcional)</label><input type="text" value={vehicle.numero_chasis || ''} onChange={e => handleVehicleChange(index, 'numero_chasis', e.target.value)} className="mt-1 block w-full input-class" /></div>
                                    <div><label className="block text-sm font-medium text-taller-gray dark:text-gray-400">Nº Motor (opcional)</label><input type="text" value={vehicle.numero_motor || ''} onChange={e => handleVehicleChange(index, 'numero_motor', e.target.value)} className="mt-1 block w-full input-class" /></div>
                                </div>
                                <div className="flex justify-end pt-2">
                                    <button type="button" onClick={() => handleRemoveVehicle(index)} disabled={vehicles.length <= 1} className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 disabled:opacity-50 disabled:cursor-not-allowed" title={vehicles.length <= 1 ? "No se puede eliminar" : "Eliminar"}>
                                        <TrashIcon className="h-4 w-4" /> Eliminar
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
             <button type="button" onClick={handleAddNewVehicle} className="w-full flex items-center justify-center gap-2 mt-3 px-3 py-2 text-sm font-semibold text-taller-primary bg-blue-50 border-2 border-dashed border-taller-primary/50 rounded-lg hover:bg-blue-100 dark:text-blue-300 dark:bg-blue-900/30 dark:border-blue-500/50 dark:hover:bg-blue-900/50">
                <PlusIcon className="h-5 w-5"/> Añadir Nuevo Vehículo
            </button>
        </div>
    );

    const modalContent = (
         <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-end sm:items-center z-[100] sm:p-4">
             <div className="bg-white dark:bg-gray-800 w-full h-[100dvh] sm:h-auto sm:max-h-[90vh] sm:max-w-2xl sm:rounded-xl shadow-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
                    <h2 className="text-xl font-bold text-taller-dark dark:text-taller-light">{isEditMode ? 'Editar Cliente' : 'Crear Nuevo Cliente'}</h2>
                    <button onClick={onClose} className="p-2 -mr-2 text-taller-gray dark:text-gray-400 hover:text-taller-dark dark:hover:text-white rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                        <XMarkIcon className="h-6 w-6" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 overscroll-contain">
                     <form id="client-form" onSubmit={handleSubmit} className="space-y-4 pb-24 sm:pb-0">
                        <div className="flex justify-between items-center border-b dark:border-gray-600 pb-2">
                            <h3 className="text-md font-semibold text-taller-dark dark:text-taller-light">Datos del Cliente</h3>
                            {contactApiAvailable && !isEditMode && (<button type="button" onClick={handleSelectContact} className="flex items-center gap-2 px-3 py-1 text-sm font-semibold text-taller-secondary bg-blue-50 border border-taller-secondary/50 rounded-lg shadow-sm hover:bg-blue-100 dark:text-blue-300 dark:bg-blue-900/30 dark:border-blue-500/50 dark:hover:bg-blue-900/50"><ClipboardDocumentCheckIcon className="h-4 w-4" /> Contacto</button>)}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div><label htmlFor="nombre" className="block text-sm font-medium text-taller-gray dark:text-gray-400">Nombre</label><input type="text" id="nombre" value={nombre} onChange={e => setNombre(e.target.value)} className="mt-1 block w-full input-class" required /></div>
                            <div><label htmlFor="apellido" className="block text-sm font-medium text-taller-gray dark:text-gray-400">Apellido</label><input type="text" id="apellido" value={apellido} onChange={e => setApellido(e.target.value)} className="mt-1 block w-full input-class" /></div>
                            <div><label htmlFor="telefono" className="block text-sm font-medium text-taller-gray dark:text-gray-400">Teléfono (Opcional)</label><input type="tel" id="telefono" value={telefono} onChange={e => setTelefono(e.target.value)} className="mt-1 block w-full input-class" /></div>
                            <div><label htmlFor="email" className="block text-sm font-medium text-taller-gray dark:text-gray-400">Email (para acceso al portal)</label><input type="email" id="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="cliente@ejemplo.com" className="mt-1 block w-full input-class" /></div>
                        </div>
                        
                        {isEditMode ? renderEditForm() : renderCreateForm()}
                        
                        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
                     </form>
                </div>
                
                {/* Footer */}
                <div className="border-t dark:border-gray-700 p-4 bg-white dark:bg-gray-800 flex flex-col sm:flex-row gap-3 shrink-0 z-10 safe-area-bottom">
                     {isEditMode ? (
                        <div className="w-full sm:flex-1 order-2 sm:order-1">
                            {!confirmingDelete ? (
                                <button type="button" onClick={() => setConfirmingDelete(true)} className="w-full justify-center flex items-center gap-2 py-3 px-4 border border-red-200 dark:border-red-900/50 rounded-xl text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 disabled:opacity-50 transition-colors">
                                    <TrashIcon className="h-5 w-5"/> Eliminar
                                </button>
                            ) : (
                                <div className="flex items-center justify-between gap-2 w-full p-1 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-900/50">
                                    <p className="text-xs font-bold text-red-600 pl-3">¿Confirmar?</p>
                                    <div className="flex gap-2">
                                        <button type="button" onClick={handleDeleteClient} disabled={isDeleting} className="py-2 px-3 text-sm font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 shadow-sm">{isDeleting ? '...' : 'Sí'}</button>
                                        <button type="button" onClick={() => setConfirmingDelete(false)} disabled={isDeleting} className="py-2 px-3 text-sm font-medium text-gray-700 bg-white dark:bg-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 rounded-lg">No</button>
                                    </div>
                                </div>
                            )}
                        </div>
                   ) : <div className="hidden sm:block sm:flex-1 order-1"></div>}
                   
                   <div className="flex gap-3 w-full sm:w-auto sm:flex-[2] order-1 sm:order-2">
                        <button type="button" onClick={onClose} className="flex-1 justify-center py-3 px-4 border border-gray-300 dark:border-gray-600 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">Cancelar</button>
                        <button type="button" onClick={submitForm} disabled={isSubmitting || isDeleting} className="flex-[2] justify-center py-3 px-6 border border-transparent rounded-xl shadow-lg shadow-taller-primary/30 text-sm font-bold text-white bg-taller-primary hover:bg-taller-secondary disabled:opacity-50 disabled:shadow-none transition-all active:scale-95">
                            {isSubmitting ? 'Guardando...' : (isEditMode ? 'Guardar Cambios' : 'Crear Cliente')}
                        </button>
                   </div>
                </div>
             </div>
         </div>
    );

    return createPortal(
        <>
            {modalContent}
            {isCameraModalOpen && <CameraRecognitionModal onClose={() => { setIsCameraModalOpen(false); setScanningVehicleIndex(null); }} onDataRecognized={handleDataRecognized} />}
            <style>{`
                .input-class { background-color: white; border: 1px solid #d1d5db; border-radius: 0.375rem; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); padding: 0.5rem 0.75rem; font-size: 0.875rem; line-height: 1.25rem; color: #0f172a; } 
                .dark .input-class { background-color: #374151; border-color: #4b5563; color: #f1f5f9; } 
                .input-class:focus { outline: 2px solid transparent; outline-offset: 2px; box-shadow: var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow, 0 0 #0000); border-color: #1e40af; --tw-ring-color: #1e40af; }
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

export default CrearClienteModal;
