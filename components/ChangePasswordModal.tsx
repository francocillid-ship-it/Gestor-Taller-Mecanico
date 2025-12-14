
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { XMarkIcon, KeyIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/solid';

interface ChangePasswordModalProps {
    onClose: () => void;
}

const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ onClose }) => {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [passwordValid, setPasswordValid] = useState(false);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const hasLength = newPassword.length >= 6;
        const hasContent = /^(?=.*[A-Za-z])(?=.*\d).+$/.test(newPassword);
        const matches = newPassword === confirmPassword && newPassword !== '';
        setPasswordValid(hasLength && hasContent && matches);
    }, [newPassword, confirmPassword]);

    useEffect(() => {
        requestAnimationFrame(() => setIsVisible(true));
    }, []);

    const handleClose = () => {
        setIsVisible(false);
        setTimeout(onClose, 300);
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!passwordValid) {
            setError('La nueva contraseña no cumple con los requisitos.');
            return;
        }

        setLoading(true);
        setError(null);
        setSuccessMessage(null);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user || !user.email) {
                throw new Error('No se pudo verificar el usuario actual.');
            }

            // Step 1: Verify current password by trying to sign in
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: user.email,
                password: currentPassword,
            });

            if (signInError) {
                throw new Error('La contraseña actual es incorrecta.');
            }

            // Step 2: If sign-in is successful, update the password
            const { error: updateError } = await supabase.auth.updateUser({
                password: newPassword,
            });

            if (updateError) {
                throw updateError;
            }

            setSuccessMessage('¡Contraseña actualizada con éxito!');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setTimeout(handleClose, 2000); // Close modal after 2 seconds on success

        } catch (err: any) {
            setError(err.message || 'Ocurrió un error al cambiar la contraseña.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
             <div 
                className={`fixed inset-0 bg-black/50 transition-opacity duration-300 ease-out ${isVisible ? 'opacity-100' : 'opacity-0'}`} 
                onClick={handleClose}
            />
            <div 
                className={`bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md relative z-10 transform transition-all duration-300 ease-out ${isVisible ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-4 sm:translate-y-0'}`}
            >
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-taller-dark dark:text-taller-light flex items-center">
                        <KeyIcon className="h-6 w-6 mr-2 text-taller-primary"/>
                        Cambiar Contraseña
                    </h2>
                    <button onClick={handleClose} className="text-taller-gray dark:text-gray-400 hover:text-taller-dark dark:hover:text-white"><XMarkIcon className="h-6 w-6" /></button>
                </div>
                <form onSubmit={handleChangePassword} className="space-y-4">
                    <div>
                        <label htmlFor="currentPassword" className="block text-sm font-medium text-taller-gray dark:text-gray-400">Contraseña Actual</label>
                        <input
                            type="password"
                            id="currentPassword"
                            value={currentPassword}
                            onChange={e => setCurrentPassword(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-taller-primary focus:border-taller-primary text-taller-dark dark:text-taller-light sm:text-sm"
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="newPassword" className="block text-sm font-medium text-taller-gray dark:text-gray-400">Nueva Contraseña</label>
                        <input
                            type="password"
                            id="newPassword"
                            value={newPassword}
                            onChange={e => setNewPassword(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-taller-primary focus:border-taller-primary text-taller-dark dark:text-taller-light sm:text-sm"
                            required
                        />
                    </div>
                     <div>
                        <label htmlFor="confirmPassword" className="block text-sm font-medium text-taller-gray dark:text-gray-400">Confirmar Nueva Contraseña</label>
                        <input
                            type="password"
                            id="confirmPassword"
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-taller-primary focus:border-taller-primary text-taller-dark dark:text-taller-light sm:text-sm"
                            required
                        />
                    </div>
                    <div className="text-xs text-left text-taller-gray dark:text-gray-400 space-y-1 pt-1">
                        <p className={`flex items-center gap-2 transition-colors ${newPassword.length >= 6 ? 'text-green-600' : 'text-taller-gray dark:text-gray-400'}`}>
                            {newPassword.length >= 6 ? <CheckCircleIcon className="h-4 w-4" /> : <XCircleIcon className="h-4 w-4" />}
                            <span>Mínimo 6 caracteres.</span>
                        </p>
                        <p className={`flex items-center gap-2 transition-colors ${/^(?=.*[A-Za-z])(?=.*\d).+$/.test(newPassword) ? 'text-green-600' : 'text-taller-gray dark:text-gray-400'}`}>
                            {/^(?=.*[A-Za-z])(?=.*\d).+$/.test(newPassword) ? <CheckCircleIcon className="h-4 w-4" /> : <XCircleIcon className="h-4 w-4" />}
                            <span>Al menos una letra y un número.</span>
                        </p>
                        <p className={`flex items-center gap-2 transition-colors ${newPassword && newPassword === confirmPassword ? 'text-green-600' : 'text-taller-gray dark:text-gray-400'}`}>
                            {newPassword && confirmPassword && newPassword === confirmPassword ? <CheckCircleIcon className="h-4 w-4" /> : <XCircleIcon className="h-4 w-4" />}
                            <span>Las contraseñas coinciden.</span>
                        </p>
                    </div>
                    {error && <p className="text-sm text-red-600">{error}</p>}
                    {successMessage && <p className="text-sm text-green-600">{successMessage}</p>}
                    <div className="pt-4 flex justify-end space-x-3">
                        <button type="button" onClick={handleClose} className="py-2 px-4 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                            Cancelar
                        </button>
                        <button type="submit" disabled={loading || !passwordValid} className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-taller-primary hover:bg-taller-secondary disabled:opacity-50">
                            {loading ? 'Cambiando...' : 'Cambiar Contraseña'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ChangePasswordModal;
