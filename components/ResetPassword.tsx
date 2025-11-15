import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { KeyIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/solid';

interface ResetPasswordProps {
    onResetSuccess: () => void;
}

const ResetPassword: React.FC<ResetPasswordProps> = ({ onResetSuccess }) => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [passwordValid, setPasswordValid] = useState(false);

    useEffect(() => {
        const hasLength = password.length >= 6;
        const hasContent = /^(?=.*[A-Za-z])(?=.*\d).+$/.test(password);
        const matches = password === confirmPassword && password !== '';
        setPasswordValid(hasLength && hasContent && matches);
    }, [password, confirmPassword]);

    const handlePasswordUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!passwordValid) {
            setError('Por favor, asegúrese de que la contraseña cumpla todos los requisitos.');
            return;
        }

        setLoading(true);
        setError(null);
        setSuccessMessage(null);

        try {
            const { error } = await supabase.auth.updateUser({ password });
            if (error) throw error;
            setSuccessMessage('¡Tu contraseña ha sido actualizada con éxito! Ahora puedes iniciar sesión.');
        } catch (err: any) {
            setError(err.message || 'No se pudo actualizar la contraseña. El enlace puede haber expirado.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-taller-dark">
            <div className="relative w-full max-w-md p-8 space-y-6 bg-white dark:bg-gray-800 rounded-2xl shadow-lg text-center">
                <div className="flex justify-center">
                    <KeyIcon className="h-16 w-16 text-taller-primary"/>
                </div>
                <h1 className="text-3xl font-bold text-taller-dark dark:text-taller-light">Establecer Nueva Contraseña</h1>
                
                {successMessage ? (
                    <div className="space-y-4">
                         <p className="text-green-600">{successMessage}</p>
                         <button onClick={onResetSuccess} className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-taller-primary hover:bg-taller-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-taller-primary">
                            Ir a Iniciar Sesión
                        </button>
                    </div>
                ) : (
                    <>
                        <p className="text-taller-gray dark:text-gray-400">
                            Ingresa tu nueva contraseña a continuación.
                        </p>
                        <form onSubmit={handlePasswordUpdate} className="space-y-4">
                            <div>
                                <label htmlFor="password" className="block text-sm font-medium text-taller-gray dark:text-gray-400 text-left">Nueva Contraseña</label>
                                <input type="password" id="password" value={password} onChange={e => setPassword(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-taller-primary focus:border-taller-primary text-taller-dark dark:text-taller-light sm:text-sm" required/>
                            </div>
                            <div>
                                <label htmlFor="confirmPassword" className="block text-sm font-medium text-taller-gray dark:text-gray-400 text-left">Confirmar Nueva Contraseña</label>
                                <input type="password" id="confirmPassword" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-taller-primary focus:border-taller-primary text-taller-dark dark:text-taller-light sm:text-sm" required/>
                            </div>
                            <div className="text-xs text-left text-taller-gray dark:text-gray-400 space-y-1 pt-1">
                                <p className={`flex items-center gap-2 transition-colors ${password.length >= 6 ? 'text-green-600' : 'text-taller-gray dark:text-gray-400'}`}>
                                    {password.length >= 6 ? <CheckCircleIcon className="h-4 w-4" /> : <XCircleIcon className="h-4 w-4" />}
                                    <span>Mínimo 6 caracteres.</span>
                                </p>
                                <p className={`flex items-center gap-2 transition-colors ${/^(?=.*[A-Za-z])(?=.*\d).+$/.test(password) ? 'text-green-600' : 'text-taller-gray dark:text-gray-400'}`}>
                                    {/^(?=.*[A-Za-z])(?=.*\d).+$/.test(password) ? <CheckCircleIcon className="h-4 w-4" /> : <XCircleIcon className="h-4 w-4" />}
                                    <span>Al menos una letra y un número.</span>
                                </p>
                                <p className={`flex items-center gap-2 transition-colors ${password && password === confirmPassword ? 'text-green-600' : 'text-taller-gray dark:text-gray-400'}`}>
                                    {password && confirmPassword && password === confirmPassword ? <CheckCircleIcon className="h-4 w-4" /> : <XCircleIcon className="h-4 w-4" />}
                                    <span>Las contraseñas coinciden.</span>
                                </p>
                            </div>

                            {error && <p className="text-sm text-red-600">{error}</p>}
                            
                            <div className="pt-2">
                                <button type="submit" disabled={loading || !passwordValid} className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-taller-primary hover:bg-taller-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-taller-primary disabled:opacity-50 disabled:cursor-not-allowed">
                                    {loading ? 'Actualizando...' : 'Actualizar Contraseña'}
                                </button>
                            </div>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
}

export default ResetPassword;
