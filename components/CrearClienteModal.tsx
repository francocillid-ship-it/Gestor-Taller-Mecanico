import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { XMarkIcon } from '@heroicons/react/24/solid';

interface CrearClienteModalProps {
    onClose: () => void;
    onSuccess: () => void;
}

const CrearClienteModal: React.FC<CrearClienteModalProps> = ({ onClose, onSuccess }) => {
    const [nombre, setNombre] = useState('');
    const [email, setEmail] = useState('');
    const [telefono, setTelefono] = useState('');

    const [marca, setMarca] = useState('');
    const [modelo, setModelo] = useState('');
    const [año, setAño] = useState('');
    const [matricula, setMatricula] = useState('');

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError('');

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("User not authenticated");
            
            // Create a user for the client to log in
            const { data: clientAuthData, error: authError } = await supabase.auth.signUp({
                email,
                password: `password-${Date.now()}`, // Temporary password, client should reset
                options: {
                    data: {
                        role: 'cliente'
                    }
                }
            });
            
            if (authError) throw authError;
            if (!clientAuthData.user) throw new Error("Could not create client user");

            // Insert client profile
            const { data: clienteData, error: clienteError } = await supabase
                .from('clientes')
                .insert({
                    id: clientAuthData.user.id, // Link to auth user
                    taller_id: user.id,
                    nombre,
                    email,
                    telefono
                })
                .select()
                .single();
            
            if (clienteError) throw clienteError;

            // Insert vehiculo
            const { error: vehiculoError } = await supabase
                .from('vehiculos')
                .insert({
                    cliente_id: clienteData.id,
                    marca,
                    modelo,
                    año: parseInt(año),
                    matricula
                });

            if (vehiculoError) throw vehiculoError;

            onSuccess();
        } catch (err: any) {
            setError(err.message || 'Error al crear el cliente.');
            console.error(err);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
         <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-taller-dark">Crear Nuevo Cliente</h2>
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
                        <label htmlFor="email" className="block text-sm font-medium text-taller-gray">Email (para acceso al portal)</label>
                        <input type="email" id="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-taller-primary focus:border-taller-primary sm:text-sm" required />
                    </div>

                    <h3 className="text-md font-semibold text-taller-dark border-b pb-2 pt-4">Datos del Vehículo Inicial</h3>
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

                    <div className="pt-4 flex justify-end space-x-3">
                         <button type="button" onClick={onClose} className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                            Cancelar
                        </button>
                        <button type="submit" disabled={isSubmitting} className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-taller-primary hover:bg-taller-secondary disabled:opacity-50">
                            {isSubmitting ? 'Creando...' : 'Crear Cliente'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CrearClienteModal;
