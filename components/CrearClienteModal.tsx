import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { XMarkIcon, TrashIcon, ClipboardDocumentCheckIcon, ChevronDownIcon, PlusIcon } from '@heroicons/react/24/solid';
import type { Cliente, Vehiculo } from '../types';
import type { TallerInfo } from './TallerDashboard';

interface CrearClienteModalProps {
    onClose: () => void;
    onSuccess: () => void;
    clienteToEdit?: Cliente | null;
}

type VehicleFormState = Omit<Vehiculo, 'id' | 'año'> & { id?: string; año: string };

const CrearClienteModal: React.FC<CrearClienteModalProps> = ({ onClose, onSuccess, clienteToEdit }) => {
    const [nombre, setNombre] = useState('');
    const [email, setEmail] = useState('');
    const [telefono, setTelefono] = useState('');

    // State for create mode (first vehicle)
    const [marca, setMarca] = useState('');
    const [modelo, setModelo] = useState('');
    const [año, setAño] = useState('');
    const [matricula, setMatricula] = useState('');
    
    // State for edit mode (multiple vehicles)
    const [vehicles, setVehicles] = useState<VehicleFormState[]>([]);
    const [deletedVehicleIds, setDeletedVehicleIds] = useState<string[]>([]);
    const [expandedVehicleId, setExpandedVehicleId] = useState<string | null>(null);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [confirmingDelete, setConfirmingDelete] = useState(false);
    const [error, setError] = useState('');
    const [contactApiAvailable, setContactApiAvailable] = useState(false);

    const isEditMode = Boolean(clienteToEdit);

    useEffect(() => {
        if ('contacts' in navigator && 'select' in (navigator as any).contacts) {
            setContactApiAvailable(true);
        }
    }, []);

    useEffect(() => {
        if (clienteToEdit) {
            setNombre(clienteToEdit.nombre);
            setEmail(clienteToEdit.email || '');
            setTelefono(clienteToEdit.telefono);
            setVehicles(clienteToEdit.vehiculos.map(v => ({...v, año: String(v.año)})) || []);
        }
    }, [clienteToEdit]);
    
    const handleSelectContact = async () => {
        const props = ['name', 'email', 'tel'];
        const opts = { multiple: false };

        try {
            const contacts = await (navigator as any).contacts.select(props, opts);
            if (contacts.length === 0) return;
            const contact = contacts[0];
            if (contact.name && contact.name.length > 0) setNombre(contact.name[0]);
            if (contact.tel && contact.tel.length > 0) setTelefono(contact.tel[0]);
            if (contact.email && contact.email.length > 0) setEmail(contact.email[0]);
        } catch (ex) {
            console.error('Error selecting contact:', ex);
            setError('No se pudo acceder a los contactos.');
        }
    };

    const handleDeleteClient = async () => {
        if (!clienteToEdit) return;

        setIsDeleting(true);
        setError('');
        try {
            const { error: vehiculoError } = await supabase.from('vehiculos').delete().eq('cliente_id', clienteToEdit.id);
            if (vehiculoError) throw vehiculoError;
            const { error: clienteError } = await supabase.from('clientes').delete().eq('id', clienteToEdit.id);
            if (clienteError) throw clienteError;
            onSuccess();
        } catch (err: any) {
            setError(err.message || 'Error al eliminar el cliente.');
        } finally {
            setIsDeleting(false);
            setConfirmingDelete(false);
        }
    };
    
    const handleVehicleChange = (index: number, field: keyof VehicleFormState, value: string) => {
        const updatedVehicles = [...vehicles];
        updatedVehicles[index] = { ...updatedVehicles[index], [field]: value };
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
        if (vehicleToRemove.id) {
            setDeletedVehicleIds(prev => [...prev, vehicleToRemove.id!]);
        }
        setVehicles(prev => prev.filter((_, index) => index !== indexToRemove));
    };


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError('');

        try {
            if (isEditMode) {
                // UPDATE CLIENT
                const { error: clienteError } = await supabase
                    .from('clientes')
                    .update({ nombre, email, telefono })
                    .eq('id', clienteToEdit!.id);
                if (clienteError) throw clienteError;

                // HANDLE VEHICLE DELETIONS
                if (deletedVehicleIds.length > 0) {
                    const { error: deleteError } = await supabase.from('vehiculos').delete().in('id', deletedVehicleIds);
                    if (deleteError) throw deleteError;
                }

                // HANDLE VEHICLE UPDATES & INSERTS
                for (const vehicle of vehicles) {
                    const yearNumber = parseInt(vehicle.año);
                     if (isNaN(yearNumber) || yearNumber <= 1900 || yearNumber > new Date().getFullYear() + 2) {
                        throw new Error(`Año inválido para ${vehicle.marca} ${vehicle.modelo}.`);
                    }
                    
                    const vehicleData = {
                        marca: vehicle.marca,
                        modelo: vehicle.modelo,
                        año: yearNumber,
                        matricula: vehicle.matricula,
                        numero_chasis: vehicle.numero_chasis,
                        numero_motor: vehicle.numero_motor,
                        cliente_id: clienteToEdit!.id
                    };
                    
                    if (vehicle.id) {
                        const { error: updateError } = await supabase.from('vehiculos').update(vehicleData).eq('id', vehicle.id);
                        if (updateError) throw updateError;
                    } else {
                        const { error: insertError } = await supabase.from('vehiculos').insert(vehicleData);
                        if (insertError) throw insertError;
                    }
                }

            } else {
                // CREATE CLIENT
                const yearNumber = parseInt(año);
                if (isNaN(yearNumber) || yearNumber <= 1900 || yearNumber > new Date().getFullYear() + 2) {
                    throw new Error('Por favor, ingrese un año válido para el vehículo.');
                }
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) throw new Error("User not authenticated");

                const clientEmail = email.trim();
                const authEmail = clientEmail || `${crypto.randomUUID()}@placeholder.email`;
                const tallerNombre = (user.user_metadata.taller_info as TallerInfo | undefined)?.nombre || 'Mi Taller';
                
                const { data: clientAuthData, error: authError } = await supabase.auth.signUp({
                    email: authEmail,
                    password: `password-${Date.now()}`,
                    options: { data: { role: 'cliente', taller_nombre_ref: tallerNombre } }
                });
                
                if (authError && authError.message !== 'User already registered') throw authError;
                
                let clientUserId = clientAuthData?.user?.id;
                if (!clientUserId && clientEmail) {
                    const { data: existingUser } = await supabase.from('clientes').select('id').eq('email', clientEmail).single();
                    if(existingUser) clientUserId = existingUser.id;
                }
                if (!clientUserId) throw new Error("Could not find or create client user");

                const { data: clienteData, error: clienteError } = await supabase
                    .from('clientes').insert({ id: clientUserId, taller_id: user.id, nombre, email: clientEmail, telefono }).select().single();
                if (clienteError) throw clienteError;

                const { error: vehiculoError } = await supabase
                    .from('vehiculos').insert({ cliente_id: clienteData.id, marca, modelo, año: yearNumber, matricula });
                if (vehiculoError) throw vehiculoError;
            }

            onSuccess();
        } catch (err: any) {
            setError(err.message || `Error al ${isEditMode ? 'actualizar' : 'crear'} el cliente.`);
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const renderCreateForm = () => (
        <>
            <h3 className="text-md font-semibold text-taller-dark dark:text-taller-light border-b dark:border-gray-600 pb-2 pt-4">Datos del Vehículo</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="marca" className="block text-sm font-medium text-taller-gray dark:text-gray-400">Marca</label>
                    <input type="text" id="marca" value={marca} onChange={e => setMarca(e.target.value)} className="mt-1 block w-full input-class" required />
                </div>
                <div>
                    <label htmlFor="modelo" className="block text-sm font-medium text-taller-gray dark:text-gray-400">Modelo</label>
                    <input type="text" id="modelo" value={modelo} onChange={e => setModelo(e.target.value)} className="mt-1 block w-full input-class" required />
                </div>
                <div>
                    <label htmlFor="año" className="block text-sm font-medium text-taller-gray dark:text-gray-400">Año</label>
                    <input type="number" id="año" value={año} onChange={e => setAño(e.target.value)} className="mt-1 block w-full input-class" required />
                </div>
                <div>
                    <label htmlFor="matricula" className="block text-sm font-medium text-taller-gray dark:text-gray-400">Matrícula</label>
                    <input type="text" id="matricula" value={matricula} onChange={e => setMatricula(e.target.value)} className="mt-1 block w-full input-class" required />
                </div>
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
                        <button
                            type="button"
                            onClick={() => setExpandedVehicleId(expandedVehicleId === uniqueKey ? null : uniqueKey)}
                            className="w-full p-3 flex justify-between items-center text-left bg-taller-light/50 dark:bg-gray-700/50 hover:bg-taller-light dark:hover:bg-gray-700"
                        >
                            <span className="font-semibold text-taller-dark dark:text-taller-light">{vehicle.marca || '[Nuevo Vehículo]'} {vehicle.modelo}</span>
                            <ChevronDownIcon className={`h-5 w-5 text-taller-gray dark:text-gray-400 transform transition-transform ${expandedVehicleId === uniqueKey ? 'rotate-180' : ''}`} />
                        </button>
                        {expandedVehicleId === uniqueKey && (
                            <div className="p-4 bg-white dark:bg-gray-800 space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-taller-gray dark:text-gray-400">Marca</label>
                                        <input type="text" value={vehicle.marca} onChange={e => handleVehicleChange(index, 'marca', e.target.value)} className="mt-1 block w-full input-class" required />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-taller-gray dark:text-gray-400">Modelo</label>
                                        <input type="text" value={vehicle.modelo} onChange={e => handleVehicleChange(index, 'modelo', e.target.value)} className="mt-1 block w-full input-class" required />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-taller-gray dark:text-gray-400">Año</label>
                                        <input type="number" value={vehicle.año} onChange={e => handleVehicleChange(index, 'año', e.target.value)} className="mt-1 block w-full input-class" required />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-taller-gray dark:text-gray-400">Matrícula</label>
                                        <input type="text" value={vehicle.matricula} onChange={e => handleVehicleChange(index, 'matricula', e.target.value)} className="mt-1 block w-full input-class" required />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-taller-gray dark:text-gray-400">Nº Chasis (opcional)</label>
                                        <input type="text" value={vehicle.numero_chasis || ''} onChange={e => handleVehicleChange(index, 'numero_chasis', e.target.value)} className="mt-1 block w-full input-class" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-taller-gray dark:text-gray-400">Nº Motor (opcional)</label>
                                        <input type="text" value={vehicle.numero_motor || ''} onChange={e => handleVehicleChange(index, 'numero_motor', e.target.value)} className="mt-1 block w-full input-class" />
                                    </div>
                                </div>
                                <div className="flex justify-end pt-2">
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveVehicle(index)}
                                        disabled={vehicles.length <= 1}
                                        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 disabled:opacity-50 disabled:cursor-not-allowed"
                                        title={vehicles.length <= 1 ? "No se puede eliminar el único vehículo" : "Eliminar vehículo"}
                                    >
                                        <TrashIcon className="h-4 w-4" />
                                        Eliminar Vehículo
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
             <button
                type="button"
                onClick={handleAddNewVehicle}
                className="w-full flex items-center justify-center gap-2 mt-3 px-3 py-2 text-sm font-semibold text-taller-primary bg-blue-50 border-2 border-dashed border-taller-primary/50 rounded-lg hover:bg-blue-100 dark:text-blue-300 dark:bg-blue-900/30 dark:border-blue-500/50 dark:hover:bg-blue-900/50"
            >
                <PlusIcon className="h-5 w-5"/>
                Añadir Nuevo Vehículo
            </button>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-taller-dark dark:text-taller-light">{isEditMode ? 'Editar Cliente' : 'Crear Nuevo Cliente'}</h2>
                    <button onClick={onClose} className="text-taller-gray dark:text-gray-400 hover:text-taller-dark dark:hover:text-white"><XMarkIcon className="h-6 w-6" /></button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="flex justify-between items-center border-b dark:border-gray-600 pb-2">
                        <h3 className="text-md font-semibold text-taller-dark dark:text-taller-light">Datos del Cliente</h3>
                        {contactApiAvailable && !isEditMode && (
                            <button type="button" onClick={handleSelectContact} className="flex items-center gap-2 px-3 py-1 text-sm font-semibold text-taller-secondary bg-blue-50 border border-taller-secondary/50 rounded-lg shadow-sm hover:bg-blue-100 dark:text-blue-300 dark:bg-blue-900/30 dark:border-blue-500/50 dark:hover:bg-blue-900/50">
                                <ClipboardDocumentCheckIcon className="h-4 w-4" />
                                Seleccionar Contacto
                            </button>
                        )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="nombre" className="block text-sm font-medium text-taller-gray dark:text-gray-400">Nombre Completo</label>
                            <input type="text" id="nombre" value={nombre} onChange={e => setNombre(e.target.value)} className="mt-1 block w-full input-class" required />
                        </div>
                        <div>
                            <label htmlFor="telefono" className="block text-sm font-medium text-taller-gray dark:text-gray-400">Teléfono</label>
                            <input type="tel" id="telefono" value={telefono} onChange={e => setTelefono(e.target.value)} className="mt-1 block w-full input-class" required />
                        </div>
                    </div>
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-taller-gray dark:text-gray-400">Email (opcional, para acceso al portal)</label>
                        <input type="email" id="email" value={email} onChange={e => setEmail(e.target.value)} disabled={isEditMode} className="mt-1 block w-full input-class disabled:bg-gray-200 dark:disabled:bg-gray-700/50" />
                    </div>
                    
                    {isEditMode ? renderEditForm() : renderCreateForm()}

                    {error && <p className="text-sm text-red-600 mt-2">{error}</p>}

                    <div className="pt-4 flex justify-between items-center">
                         <div>
                            {isEditMode && !confirmingDelete && (
                                <button type="button" onClick={() => setConfirmingDelete(true)} className="flex items-center gap-2 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50">
                                    <TrashIcon className="h-5 w-5"/>
                                    Eliminar Cliente
                                </button>
                            )}
                            {isEditMode && confirmingDelete && (
                                <div className="flex items-center gap-3">
                                    <p className="text-sm font-medium text-red-700 animate-pulse">¿Confirmar?</p>
                                    <button type="button" onClick={handleDeleteClient} disabled={isDeleting} className="py-1 px-3 text-sm font-bold text-white bg-red-600 rounded-md hover:bg-red-700">{isDeleting ? '...' : 'Sí'}</button>
                                    <button type="button" onClick={() => setConfirmingDelete(false)} disabled={isDeleting} className="py-1 px-3 text-sm font-medium text-gray-700 bg-gray-200 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500 rounded-md">No</button>
                                </div>
                            )}
                        </div>
                        <div className="flex justify-end space-x-3">
                             <button type="button" onClick={onClose} className="py-2 px-4 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">Cancelar</button>
                             <button type="submit" disabled={isSubmitting || isDeleting} className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-taller-primary hover:bg-taller-secondary disabled:opacity-50">{isSubmitting ? 'Guardando...' : (isEditMode ? 'Guardar Cambios' : 'Crear Cliente')}</button>
                        </div>
                    </div>
                </form>
            </div>
            <style>{`
                .input-class {
                    background-color: white;
                    border: 1px solid #d1d5db;
                    border-radius: 0.375rem;
                    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
                    padding: 0.5rem 0.75rem;
                    font-size: 0.875rem;
                    line-height: 1.25rem;
                    color: #0f172a;
                }
                .dark .input-class {
                    background-color: #374151;
                    border-color: #4b5563;
                    color: #f1f5f9;
                }
                .input-class:focus {
                    outline: 2px solid transparent;
                    outline-offset: 2px;
                    --tw-ring-offset-shadow: var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color);
                    --tw-ring-shadow: var(--tw-ring-inset) 0 0 0 calc(2px + var(--tw-ring-offset-width)) var(--tw-ring-color);
                    box-shadow: var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow, 0 0 #0000);
                    border-color: #1e40af;
                    --tw-ring-color: #1e40af;
                }
            `}</style>
        </div>
    );
};

export default CrearClienteModal;
