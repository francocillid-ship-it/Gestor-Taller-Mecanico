import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { XMarkIcon, TrashIcon } from '@heroicons/react/24/solid';
import type { Cliente } from '../types';
import type { TallerInfo } from './TallerDashboard';

interface CrearClienteModalProps {
    onClose: () => void;
    onSuccess: () => void;
    clienteToEdit?: Cliente | null;
}

const CrearClienteModal: React.FC<CrearClienteModalProps> = ({ onClose, onSuccess, clienteToEdit }) => {
    const [nombre, setNombre] = useState('');
    const [email, setEmail] = useState('');
    const [telefono, setTelefono] = useState('');

    const [marca, setMarca] = useState('');
    const [modelo, setModelo] = useState('');
    const [año, setAño] = useState('');
    const [matricula, setMatricula] = useState('');

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [confirmingDelete, setConfirmingDelete] = useState(false);
    const [error, setError] = useState('');

    const isEditMode = Boolean(clienteToEdit);

    useEffect(() => {
        if (clienteToEdit) {
            setNombre(clienteToEdit.nombre);
            setEmail(clienteToEdit.email || '');
            setTelefono(clienteToEdit.telefono);
            if (clienteToEdit.vehiculos && clienteToEdit.vehiculos.length > 0) {
                const firstVehicle = clienteToEdit.vehiculos[0];
                setMarca(firstVehicle.marca);
                setModelo(firstVehicle.modelo);
                setAño(String(firstVehicle.año));
                setMatricula(firstVehicle.matricula);
            }
        }
    }, [clienteToEdit]);

    const handleDeleteClient = async () => {
        if (!clienteToEdit) return;

        setIsDeleting(true);
        setError('');
        try {
            // Delete associated vehicles first
            const { error: vehiculoError } = await supabase
                .from('vehiculos')
                .delete()
                .eq('cliente_id', clienteToEdit.id);
            if (vehiculoError) throw vehiculoError;

            // Then delete the client profile
            const { error: clienteError } = await supabase
                .from('clientes')
                .delete()
                .eq('id', clienteToEdit.id);
            if (clienteError) throw clienteError;
            
            // Note: The auth user is intentionally not deleted from the client-side
            // as it would require admin privileges, which is a security risk.

            onSuccess();
        } catch (err: any) {
            setError(err.message || 'Error al eliminar el cliente.');
            console.error(err);
        } finally {
            setIsDeleting(false);
            setConfirmingDelete(false);
        }
    };


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError('');

        try {
            if (isEditMode) {
                // Update logic
                const { error: clienteError } = await supabase
                    .from('clientes')
                    .update({ nombre, email, telefono })
                    .eq('id', clienteToEdit!.id);
                if (clienteError) throw clienteError;

                if (clienteToEdit!.vehiculos && clienteToEdit!.vehiculos.length > 0) {
                    const vehicleId = clienteToEdit!.vehiculos[0].id;
                    const { error: vehiculoError } = await supabase
                        .from('vehiculos')
                        .update({ marca, modelo, año: parseInt(año), matricula })
                        .eq('id', vehicleId);
                    if (vehiculoError) throw vehiculoError;
                } else {
                     const { error: vehiculoError } = await supabase
                        .from('vehiculos')
                        .insert({ cliente_id: clienteToEdit!.id, marca, modelo, año: parseInt(año), matricula });
                     if (vehiculoError) throw vehiculoError;
                }
            } else {
                // Create logic
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) throw new Error("User not authenticated");

                const clientEmail = email.trim();
                const authEmail = clientEmail || `${crypto.randomUUID()}@placeholder.email`;
                
                const tallerInfo = user.user_metadata.taller_info as TallerInfo | undefined;
                const tallerNombre = tallerInfo?.nombre || 'Mi Taller';
                
                const { data: clientAuthData, error: authError } = await supabase.auth.signUp({
                    email: authEmail,
                    password: `password-${Date.now()}`,
                    options: { data: { role: 'cliente', taller_nombre_ref: tallerNombre } }
                });
                
                if (authError && authError.message !== 'User already registered') throw authError;
                
                const clientUserId = clientAuthData?.user?.id || (await supabase.from('clientes').select('id').eq('email', email).single()).data?.id;

                if (!clientUserId) throw new Error("Could not find or create client user");

                const { data: clienteData, error: clienteError } = await supabase
                    .from('clientes')
                    .insert({ id: clientUserId, taller_id: user.id, nombre, email: clientEmail, telefono })
                    .select().single();
                
                if (clienteError) throw clienteError;

                const { error: vehiculoError } = await supabase
                    .from('vehiculos')
                    .insert({ cliente_id: clienteData.id, marca, modelo, año: parseInt(año), matricula });
                if (vehiculoError) throw vehiculoError;
            }

            onSuccess();
        } catch (err: any) {
            setError(err.message || `Error al ${isEditMode ? 'actualizar' : 'crear'} el cliente.`);
            console.error(err);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
         <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-taller-dark">{isEditMode ? 'Editar Cliente' : 'Crear Nuevo Cliente'}</h2>
                    <button onClick={onClose} className="text-taller-gray hover:text-taller-dark"><XMarkIcon className="h-6 w-6" /></button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <h3 className="text-md font-semibold text-taller-dark border-b pb-2">Datos del Cliente</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="nombre" className="block text-sm font-medium text-taller-gray">Nombre Completo</label>
                            <input type="text" id="nombre" value={nombre} onChange={e => setNombre(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-taller-primary focus:border-taller-primary sm:text-sm" required />
                        </div>
                        <div>
                            <label htmlFor="telefono" className="block text-sm font-medium text-taller-gray">Teléfono</label>
                            <input type="tel" id="telefono" value={telefono} onChange={e => setTelefono(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-taller-primary focus:border-taller-primary sm:text-sm" required />
                        </div>
                    </div>
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-taller-gray">Email (opcional, para acceso al portal)</label>
                        <input type="email" id="email" value={email} onChange={e => setEmail(e.target.value)} disabled={isEditMode} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-taller-primary focus:border-taller-primary sm:text-sm disabled:bg-gray-100" />
                    </div>

                    <h3 className="text-md font-semibold text-taller-dark border-b pb-2 pt-4">Datos del Vehículo</h3>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="marca" className="block text-sm font-medium text-taller-gray">Marca</label>
                            <input type="text" id="marca" value={marca} onChange={e => setMarca(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-taller-primary focus:border-taller-primary sm:text-sm" required />
                        </div>
                        <div>
                            <label htmlFor="modelo" className="block text-sm font-medium text-taller-gray">Modelo</label>
                            <input type="text" id="modelo" value={modelo} onChange={e => setModelo(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-taller-primary focus:border-taller-primary sm:text-sm" required />
                        </div>
                         <div>
                            <label htmlFor="año" className="block text-sm font-medium text-taller-gray">Año</label>
                            <input type="number" id="año" value={año} onChange={e => setAño(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-taller-primary focus:border-taller-primary sm:text-sm" required />
                        </div>
                         <div>
                            <label htmlFor="matricula" className="block text-sm font-medium text-taller-gray">Matrícula</label>
                            <input type="text" id="matricula" value={matricula} onChange={e => setMatricula(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-taller-primary focus:border-taller-primary sm:text-sm" required />
                        </div>
                    </div>

                    {error && <p className="text-sm text-red-600">{error}</p>}

                    <div className="pt-4 flex justify-between items-center">
                         <div>
                            {isEditMode && !confirmingDelete && (
                                <button
                                    type="button"
                                    onClick={() => setConfirmingDelete(true)}
                                    className="flex items-center gap-2 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
                                >
                                    <TrashIcon className="h-5 w-5"/>
                                    Eliminar Cliente
                                </button>
                            )}
                            {isEditMode && confirmingDelete && (
                                <div className="flex items-center gap-3">
                                    <p className="text-sm font-medium text-red-700 animate-pulse">¿Confirmar?</p>
                                    <button
                                        type="button"
                                        onClick={handleDeleteClient}
                                        disabled={isDeleting}
                                        className="py-1 px-3 text-sm font-bold text-white bg-red-600 rounded-md hover:bg-red-700"
                                    >
                                        {isDeleting ? '...' : 'Sí'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setConfirmingDelete(false)}
                                        disabled={isDeleting}
                                        className="py-1 px-3 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
                                    >
                                        No
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="flex justify-end space-x-3">
                             <button type="button" onClick={onClose} className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                                Cancelar
                            </button>
                            <button type="submit" disabled={isSubmitting || isDeleting} className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-taller-primary hover:bg-taller-secondary disabled:opacity-50">
                                {isSubmitting ? 'Guardando...' : (isEditMode ? 'Guardar Cambios' : 'Crear Cliente')}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CrearClienteModal;