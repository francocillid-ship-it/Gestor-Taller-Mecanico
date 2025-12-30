import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { KeyIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/solid';

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
            // Pequeño delay para que el usuario vea el check de éxito antes de entrar al portal
            setTimeout(() => {
                onSetSuccess();
            }, 800);
            
        } catch (err: any) {
            setError(err.message || 'No se pudo establecer la contraseña. El enlace de invitación puede haber expirado.');
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-taller-dark p-4">
            <div className="relative w-full max-w-md p-8 space-y-6 bg-white dark:bg-gray-800 rounded-2xl shadow-lg text-center">
                <div className="flex justify-center">
                    <div className={`p-4 rounded-full transition-colors duration-500 ${success ? 'bg-green-100 dark:bg-green-900/30' : 'bg-taller-light dark:bg-gray-700'}`}>
                        <KeyIcon className={`h-12 w-12 transition-colors duration-500 ${success ? 'text-green-600' : 'text-taller-primary'}`}/>
                    </div>
                </div>
                
                <h1 className="text-2xl sm:text-3xl font-bold text-taller-dark dark:text-taller-light">
                    {success ? '¡Todo listo!' : 'Crea tu Contraseña'}
                </h1>
                
                {success ? (
                    <div className="animate-in fade-in zoom-in duration-500">
                         <p className="text-taller-gray dark:text-gray-400">Iniciando sesión automáticamente...</p>
                         <div className="flex justify-center mt-4">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                         </div>
                    </div>
                ) : (
                    <>
                        <p className="text-sm text-taller-gray dark:text-gray-400">
                            ¡Bienvenido! Para acceder a tu historial y estado de trabajos, crea una contraseña nueva.
                        </p>
                        <form onSubmit={handlePasswordUpdate} className="space-y-4 text-left">
                            <div>
                                <label htmlFor="password" className="block text-xs font-bold text-taller-gray dark:text-gray-400 uppercase tracking-wider mb-1">Nueva Contraseña</label>
                                <input 
                                    type="password" 
                                    id="password" 
                                    value={password} 
                                    onChange={e => setPassword(e.target.value)} 
                                    className="block w-full px-3 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-taller-primary focus:border-taller-primary text-taller-dark dark:text-taller-light sm:text-sm" 
                                    required
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label htmlFor="confirmPassword" className="block text-xs font-bold text-taller-gray dark:text-gray-400 uppercase tracking-wider mb-1">Confirmar Contraseña</label>
                                <input 
                                    type="password" 
                                    id="confirmPassword" 
                                    value={confirmPassword} 
                                    onChange={e => setConfirmPassword(e.target.value)} 
                                    className="block w-full px-3 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-taller-primary focus:border-taller-primary text-taller-dark dark:text-taller-light sm:text-sm" 
                                    required
                                />
                            </div>
                            
                            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg border dark:border-gray-700">
                                <div className="flex items-center h-5">
                                    <input
                                        id="remember-me"
                                        name="remember-me"
                                        type="checkbox"
                                        checked={rememberMe}
                                        onChange={(e) => setRememberMe(e.target.checked)}
                                        className="h-4 w-4 text-taller-primary focus:ring-taller-primary border-gray-300 dark:border-gray-600 rounded cursor-pointer"
                                    />
                                </div>
                                <label htmlFor="remember-me" className="text-sm font-medium text-taller-gray dark:text-gray-300 cursor-pointer select-none">
                                    Mantener la sesión abierta
                                </label>
                            </div>

                            <div className="text-xs space-y-2 pt-2 bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl border dark:border-gray-700">
                                <p className={`flex items-center gap-2 transition-colors ${password.length >= 6 ? 'text-green-600 dark:text-green-400 font-bold' : 'text-taller-gray dark:text-gray-400'}`}>
                                    {password.length >= 6 ? <CheckCircleIcon className="h-4 w-4" /> : <XCircleIcon className="h-4 w-4" />}
                                    <span>Mínimo 6 caracteres.</span>
                                </p>
                                <p className={`flex items-center gap-2 transition-colors ${/^(?=.*[A-Za-z])(?=.*\d).+$/.test(password) ? 'text-green-600 dark:text-green-400 font-bold' : 'text-taller-gray dark:text-gray-400'}`}>
                                    {/^(?=.*[A-Za-z])(?=.*\d).+$/.test(password) ? <CheckCircleIcon className="h-4 w-4" /> : <XCircleIcon className="h-4 w-4" />}
                                    <span>Al menos una letra y un número.</span>
                                </p>
                                <p className={`flex items-center gap-2 transition-colors ${password && password === confirmPassword ? 'text-green-600 dark:text-green-400 font-bold' : 'text-taller-gray dark:text-gray-400'}`}>
                                    {password && confirmPassword && password === confirmPassword ? <CheckCircleIcon className="h-4 w-4" /> : <XCircleIcon className="h-4 w-4" />}
                                    <span>Las contraseñas coinciden.</span>
                                </p>
                            </div>

                            {error && (
                                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-lg text-xs text-red-600 dark:text-red-400 text-center font-medium">
                                    {error}
                                </div>
                            )}
                            
                            <div className="pt-4">
                                <button 
                                    type="submit" 
                                    disabled={loading || !passwordValid} 
                                    className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-lg shadow-taller-primary/30 text-base font-bold text-white bg-taller-primary hover:bg-taller-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-taller-primary disabled:opacity-50 disabled:shadow-none transition-all active:scale-95"
                                >
                                    {loading ? 'Procesando...' : 'Establecer Contraseña y Entrar'}
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