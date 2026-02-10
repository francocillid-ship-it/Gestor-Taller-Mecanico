
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { KeyIcon, CheckCircleIcon, XCircleIcon, WrenchScrewdriverIcon } from '@heroicons/react/24/solid';

interface SetInitialPasswordProps {
    onSetSuccess: () => void;
}

const SetInitialPassword: React.FC<SetInitialPasswordProps> = ({ onSetSuccess }) => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
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

        try {
            const { error: updateError } = await supabase.auth.updateUser({ password });
            if (updateError) throw updateError;
            
            setSuccess(true);
            setTimeout(() => {
                onSetSuccess();
            }, 1000);
            
        } catch (err: any) {
            setError(err.message || 'No se pudo establecer la contraseña. El enlace de invitación puede haber expirado.');
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center app-height bg-gray-100 dark:bg-taller-dark">
            <div className="relative w-full max-w-md p-8 space-y-6 bg-white dark:bg-gray-800 rounded-2xl shadow-lg text-center">
                
                {success ? (
                    <div className="py-8 animate-in fade-in zoom-in duration-500">
                        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
                            <CheckCircleIcon className="h-10 w-10 text-green-600 dark:text-green-400" />
                        </div>
                        <h2 className="text-2xl font-bold text-taller-dark dark:text-taller-light mb-2">¡Todo listo!</h2>
                        <p className="text-taller-gray dark:text-gray-400">Iniciando sesión en tu portal...</p>
                    </div>
                ) : (
                    <>
                        <div className="flex justify-center mb-4">
                            <WrenchScrewdriverIcon className="h-12 w-12 text-taller-primary"/>
                        </div>
                        
                        <h2 className="text-2xl font-bold text-taller-dark dark:text-taller-light">
                            Activa tu Cuenta
                        </h2>
                        <p className="text-sm text-taller-gray dark:text-gray-400">
                            Establece una contraseña segura para acceder a tu historial de trabajos.
                        </p>

                        <form onSubmit={handlePasswordUpdate} className="space-y-4 text-left mt-6">
                            <div>
                                <label htmlFor="password" className="block text-sm font-medium text-taller-gray dark:text-gray-400 text-left">Nueva Contraseña</label>
                                <input 
                                    type="password" 
                                    id="password" 
                                    value={password} 
                                    onChange={e => setPassword(e.target.value)} 
                                    className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-taller-primary focus:border-taller-primary text-taller-dark dark:text-taller-light sm:text-sm" 
                                    required
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label htmlFor="confirmPassword" className="block text-sm font-medium text-taller-gray dark:text-gray-400 text-left">Confirmar Contraseña</label>
                                <input 
                                    type="password" 
                                    id="confirmPassword" 
                                    value={confirmPassword} 
                                    onChange={e => setConfirmPassword(e.target.value)} 
                                    className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-taller-primary focus:border-taller-primary text-taller-dark dark:text-taller-light sm:text-sm" 
                                    required
                                />
                            </div>
                            
                            <div className="flex items-center justify-between">
                                <div className="flex items-center">
                                    <input
                                        id="remember-me"
                                        name="remember-me"
                                        type="checkbox"
                                        checked={rememberMe}
                                        onChange={(e) => setRememberMe(e.target.checked)}
                                        className="h-4 w-4 text-taller-primary focus:ring-taller-primary border-gray-300 dark:border-gray-600 rounded"
                                    />
                                    <label htmlFor="remember-me" className="ml-2 block text-sm text-taller-gray dark:text-gray-400">
                                        Mantener sesión
                                    </label>
                                </div>
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

                            {error && <p className="text-sm text-red-600 text-center">{error}</p>}
                            
                            <div className="pt-4">
                                <button 
                                    type="submit" 
                                    disabled={loading || !passwordValid} 
                                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-taller-primary hover:bg-taller-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-taller-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {loading ? 'Procesando...' : 'Establecer y Entrar'}
                                </button>
                            </div>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
}

export default SetInitialPassword;
